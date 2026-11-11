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

    public function daysEach(): float
    {
        return $this->boolean('half_day') ? 0.5 : 1.0;
    }

    private function checkDates(Validator $v): void
    {
        $from = CarbonImmutable::parse($this->input('from'));
        $to = CarbonImmutable::parse($this->input('to') ?: $this->input('from'));
        $today = CarbonImmutable::today();
        $policy = Policy::current();
        /** @var User $user */
        $user = $this->user();
        $fail = fn (string $message) => $v->errors()->add('from', $message);

        if ($this->boolean('half_day') && ! $from->equalTo($to)) {
            $v->errors()->add('half_day', 'A half day is a single date. Log a range as full days.');

            return;
        }
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
            $fail('Your PTO starts on '.$user->ptoStart()->format('M j, Y').'.');

            return;
        }

        if (Ledger::cutOffFor($this->dates[0])[1]->lessThan($today)) {
            $fail('That cut-off has ended and payroll ran. Ask HR to fix past leave.');

            return;
        }

        $taken = $user->leaves()
            ->whereBetween('date', [$this->dates[0]->startOfMonth()->toDateString(), end($this->dates)->endOfMonth()->toDateString()])
            ->get(['date', 'days']);

        $clash = $taken->first(fn ($l) => in_array($l->date->toDateString(), array_map(fn ($d) => $d->toDateString(), $this->dates), true));
        if ($clash) {
            $fail('You already logged leave on '.$clash->date->format('M j').'.');

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
