<?php

namespace App\Http\Requests;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

/**
 * Logging leave: one day, a half day, or a range (each working day in it). The rules:
 * weekdays only, not on a public holiday, not before the person's PTO start, not in a cut-off that has ended
 * (payroll ran; HR fixes those), no date twice, and at most the monthly cap per month. A holiday inside a
 * range is saved set aside (see save()), so it comes back as leave if the holiday is removed.
 */
class StoreLeaveRequest extends FormRequest
{
    /** A range longer than this is almost certainly a typo. */
    private const MAX_RANGE_DAYS = 62;

    /** @var list<CarbonImmutable> */
    private array $dates = [];

    /** @var array<string, int> holiday id by Y-m-d, for the weekday holidays inside the range */
    private array $heldBack = [];

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            // full | am | pm | hours. A morning or an afternoon is half a day; "hours" is start_time to
            // end_time (Leave::OFFICE_HOURS). Each also works across a range.
            'part' => ['nullable', 'in:full,am,pm,hours'],
            'start_time' => ['required_if:part,hours', 'nullable', 'date_format:H:i'],
            'end_time' => ['required_if:part,hours', 'nullable', 'date_format:H:i'],
            // Older clients: a half day without saying which half.
            'half_day' => ['boolean'],
            'note' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $v) => $v->errors()->isEmpty() && $this->byTheHour() && $this->checkTimes($v),
            fn (Validator $v) => $v->errors()->isEmpty() && $this->checkDates($v),
        ];
    }

    /** @return list<CarbonImmutable> the weekdays to log */
    public function dates(): array
    {
        return $this->dates;
    }

    /**
     * Saves the leave. Weekday holidays inside the range are saved too but set aside for that holiday
     * (Leave::cancelled_by_holiday_id), so the day comes back if HR removes or moves the holiday.
     */
    public function save(): void
    {
        $user = $this->owner();
        $row = fn (string $date) => [
            'date' => $date,
            'days' => $this->daysEach(),
            'part' => $this->part(),
            ...$this->times(),
            'note' => $this->input('note'),
        ];
        $already = Leave::withoutGlobalScope('active')->where('user_id', $user->id)
            ->whereIn('date', array_keys($this->heldBack))->pluck('date')
            ->map(fn ($d) => substr((string) $d, 0, 10))->all();

        DB::transaction(function () use ($user, $row, $already) {
            foreach ($this->dates as $date) {
                $user->leaves()->create($row($date->toDateString()));
            }
            foreach ($this->heldBack as $date => $holidayId) {
                if ($date >= $user->ptoStart()->toDateString() && ! in_array($date, $already, true)) {
                    $user->leaves()->make($row($date))->forceFill(['cancelled_by_holiday_id' => $holidayId])->save();
                }
            }
        });
    }

    /** Whose leave this is: the signed-in person here; StoreLeaveForRequest logs it for someone else. */
    public function owner(): User
    {
        /** @var User */
        return $this->user();
    }

    /** Employees can't change a cut-off once payroll ran; HR can (StoreLeaveForRequest). */
    protected function allowsEndedCutOffs(): bool
    {
        return false;
    }

    /** The share of a working day each date is charged: its working hours ÷ the policy's hours per day. */
    public function daysEach(): float
    {
        return round($this->hoursEach() / Policy::current()->hoursPerDay, 4);
    }

    /**
     * Working hours charged per date: the chosen times; a morning (3 h) or an afternoon (5 h), from
     * Leave::HALVES; an older client's unnamed half day (half the policy day); or a full day.
     */
    public function hoursEach(): float
    {
        $perDay = Policy::current()->hoursPerDay;

        return match (true) {
            $this->byTheHour() => Leave::workingHours($this->input('start_time'), $this->input('end_time')),
            $this->part() !== null => Leave::workingHours(...Leave::HALVES[$this->part()]),
            $this->boolean('half_day') => $perDay / 2,
            default => $perDay,
        };
    }

    /** Leave for some hours of the day (start_time to end_time) rather than a full or half day. */
    public function byTheHour(): bool
    {
        return $this->input('part') === 'hours';
    }

    /** @return array{start_time: string|null, end_time: string|null} what to store */
    public function times(): array
    {
        return $this->byTheHour()
            ? ['start_time' => $this->input('start_time'), 'end_time' => $this->input('end_time')]
            : ['start_time' => null, 'end_time' => null];
    }

    /** Some hours of the day rather than whole days: by the hour, a morning or an afternoon. */
    public function partOfTheDay(): bool
    {
        return $this->byTheHour() || $this->part() !== null;
    }

    /** "2.5 h" for one day, "2.5 h a day on 3 days" for a range: for the confirmation toast. */
    public function hoursLabel(int $dayCount): string
    {
        $hours = (float) $this->hoursEach();

        return $dayCount === 1 ? "{$hours} h" : "{$hours} h a day on {$dayCount} days";
    }

    /** On the half hour, inside office hours, and covering some working time (not just lunch). */
    private function checkTimes(Validator $v): void
    {
        $start = $this->input('start_time');
        $end = $this->input('end_time');
        $open = Leave::OFFICE_HOURS[0][0];
        $close = Leave::OFFICE_HOURS[array_key_last(Leave::OFFICE_HOURS)][1];
        $onStep = fn (string $t) => (int) substr($t, 3, 2) % Leave::TIME_STEP === 0;
        $label = fn (string $t) => CarbonImmutable::createFromFormat('H:i', $t)->format('g:i A');

        if (! $onStep($start) || $start < $open) {
            $v->errors()->add('start_time', "Start on the hour or half hour, from {$label($open)}.");
        }
        if (! $onStep($end) || $end > $close) {
            $v->errors()->add('end_time', "End on the hour or half hour, by {$label($close)}.");
        } elseif ($end <= $start) {
            $v->errors()->add('end_time', 'End after the start time.');
        } elseif (Leave::workingHours($start, $end) <= 0) {
            $v->errors()->add('end_time', "That's the lunch hour: pick some working time.");
        }
    }

    /** "am" or "pm" for a half day, else null. */
    public function part(): ?string
    {
        return in_array($this->input('part'), ['am', 'pm'], true) ? $this->input('part') : null;
    }

    private function checkDates(Validator $v): void
    {
        $from = CarbonImmutable::parse($this->input('from'));
        $to = CarbonImmutable::parse($this->input('to') ?: $this->input('from'));
        $today = CarbonImmutable::today();
        $policy = Policy::current();
        $user = $this->owner();
        $self = $user->id === $this->user()->id;
        $first = explode(' ', $user->name)[0];
        $fail = fn (string $message) => $v->errors()->add('from', $message);

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            $fail('That range is over two months. Log it in smaller parts.');

            return;
        }

        $holidays = Holiday::names($from->toDateString(), $to->toDateString());
        $holidayIds = Holiday::query()->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->pluck('id', 'date')->mapWithKeys(fn ($id, $date) => [substr((string) $date, 0, 10) => $id])->all();
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            if ($d->isWeekend()) {
                continue;
            }
            if (isset($holidayIds[$d->toDateString()])) {
                $this->heldBack[$d->toDateString()] = $holidayIds[$d->toDateString()];
            } else {
                $this->dates[] = $d;
            }
        }

        if ($this->dates === []) {
            $fail($from->equalTo($to) && isset($holidays[$from->toDateString()])
                ? $from->format('M j').' is '.$holidays[$from->toDateString()].'.'
                : 'Pick at least one working day. Weekends and holidays aren\'t leave days.');

            return;
        }

        if ($this->dates[0]->lessThan($user->ptoStart())) {
            $fail(($self ? 'Your' : $first.'’s').' PTO starts on '.$user->ptoStart()->format('M j, Y').'.');

            return;
        }

        if (! $this->allowsEndedCutOffs() && Ledger::cutOffFor($this->dates[0])[1]->lessThan($today)) {
            $fail('That cut-off has ended and payroll ran. Ask HR to fix past leave.');

            return;
        }

        $taken = $user->leaves()
            ->whereBetween('date', [$this->dates[0]->startOfMonth()->toDateString(), end($this->dates)->endOfMonth()->toDateString()])
            ->get(['date', 'days']);

        $clash = $taken->first(fn ($l) => in_array($l->date->toDateString(), array_map(fn ($d) => $d->toDateString(), $this->dates), true));
        if ($clash) {
            $fail(($self ? 'You' : $first).' already logged leave on '.$clash->date->format('M j').'.');

            return;
        }

        // Leave already on a holiday isn't charged, so it doesn't count toward the cap.
        $off = Holiday::names($this->dates[0]->startOfMonth()->toDateString(), end($this->dates)->endOfMonth()->toDateString());
        $taken = $taken->reject(fn ($l) => isset($off[$l->date->toDateString()]));

        $perMonth = [];
        foreach ($this->dates as $d) {
            $perMonth[$d->format('Y-m')] = ($perMonth[$d->format('Y-m')] ?? 0) + $this->daysEach();
        }
        foreach ($perMonth as $month => $adding) {
            $used = (float) $taken->filter(fn ($l) => $l->date->format('Y-m') === $month)->sum('days');
            if ($used + $adding > $policy->monthlyCapDays) {
                $left = max(0, $policy->monthlyCapDays - $used);
                $fail(sprintf(
                    '%s would go over the %s-day monthly limit (%s %s left).',
                    CarbonImmutable::parse("$month-01")->format('F'),
                    rtrim(rtrim(number_format($policy->monthlyCapDays, 1), '0'), '.'),
                    rtrim(rtrim(number_format($left, 1), '0'), '.'),
                    $left == 1 ? 'day' : 'days',
                ));

                return;
            }
        }
    }
}
