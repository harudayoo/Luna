<?php

namespace App\Http\Requests;

use App\Models\Holiday;
use App\Models\User;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Logging leave: one day, a half day, or a range (each working day in it). The rules:
 * weekdays only, not on a public holiday, not before the person's PTO start, not in a cut-off that has ended
 * (payroll ran; HR fixes those), no date twice, and at most the monthly cap per month.
 */
class StoreLeaveRequest extends FormRequest
{
    /** A range longer than this is almost certainly a typo. */
    private const MAX_RANGE_DAYS = 62;

    /** @var list<CarbonImmutable> */
    private array $dates = [];

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            // full | am | pm. A morning or an afternoon is half a day, also across a range.
            'part' => ['nullable', 'in:full,am,pm'],
            // Older clients: a half day without saying which half.
            'half_day' => ['boolean'],
            'note' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function after(): array
    {
        return [fn (Validator $v) => $v->errors()->isEmpty() && $this->checkDates($v)];
    }

    /** @return list<CarbonImmutable> the weekdays to log */
    public function dates(): array
    {
        return $this->dates;
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

    public function daysEach(): float
    {
        return $this->part() !== null || $this->boolean('half_day') ? 0.5 : 1.0;
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
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            if (! $d->isWeekend() && ! isset($holidays[$d->toDateString()])) {
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
