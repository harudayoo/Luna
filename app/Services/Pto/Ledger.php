<?php

namespace App\Services\Pto;

use Carbon\CarbonImmutable;

/**
 * The PTO ledger: a port of the old single-file planner's engine (index.html: startPeriod,
 * horizon, workHours, settle, buildSemi), kept step for step so figures match it exactly.
 * tests/Unit/PtoLedgerTest pins it to golden values produced by that original code.
 * One addition the planner didn't have: public holidays aren't work hours, and leave dated on
 * one isn't charged. With no holidays the figures are the planner's.
 *
 * Each cut-off: carry + accrued - taken. A negative balance is unpaid (deducted on the next
 * cut-off's payslip, one cut-off in arrears) and the next cut-off starts from zero. Balances are
 * carried unrounded, so 10/3 h a cut-off reaches 10.00 rather than 9.99; each CutOff reports
 * them to 2 decimals.
 */
final class Ledger
{
    /** Safety stop, as in the planner. */
    private const MAX_CUT_OFFS = 2400;

    /**
     * @param  iterable<array{date: string, days: float|int|string}>  $leaves
     * @param  iterable<string>  $holidays  Y-m-d dates
     * @return list<CutOff>
     */
    public static function build(Policy $policy, CarbonImmutable $start, float $openingHours, iterable $leaves, CarbonImmutable $today, iterable $holidays = []): array
    {
        $off = [];
        foreach ($holidays as $date) {
            $off[substr((string) $date, 0, 10)] = true;
        }

        $sorted = [];
        foreach ($leaves as $leave) {
            $date = substr((string) $leave['date'], 0, 10);
            if (! isset($off[$date])) {
                $sorted[] = ['date' => $date, 'days' => (float) $leave['days']];
            }
        }
        usort($sorted, fn ($a, $b) => strcmp($a['date'], $b['date']));

        [$period] = self::cutOffFor($start);
        $horizon = self::horizon($period, $today, $sorted);

        $out = [];
        $carry = $openingHours;
        $i = 0;
        $n = count($sorted);
        while ($i < $n && $sorted[$i]['date'] < $period->toDateString()) {
            $i++;
        }

        while ($period->lessThanOrEqualTo($horizon) && count($out) < self::MAX_CUT_OFFS) {
            [, $end] = self::cutOffFor($period);
            $inside = [];
            while ($i < $n && $sorted[$i]['date'] <= $end->toDateString()) {
                $inside[] = $sorted[$i];
                $i++;
            }

            $taken = self::r2(array_sum(array_map(fn ($l) => $l['days'] * $policy->hoursPerDay, $inside)));
            [$accrued, $balance] = self::settle($policy, $carry, $taken, self::workHours($policy, $period, $end, $off));

            $out[] = new CutOff(
                $period, $end, self::r2($carry), self::r2($accrued), $taken, self::r2($balance),
                $balance < 0 ? self::r2(-$balance) : 0.0, $inside,
            );

            $carry = $balance > 0 ? $balance : 0.0;
            $period = $end->addDay();
        }

        return $out;
    }

    /**
     * The cut-off containing a date: the 1st-15th or the 16th-month end.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function cutOffFor(CarbonImmutable $date): array
    {
        $date = $date->startOfDay();

        return $date->day <= 15
            ? [$date->startOfMonth(), $date->setDay(15)]
            : [$date->setDay(16), $date->endOfMonth()->startOfDay()];
    }

    /** Hours due in a cut-off, the planner's settle(): returns [accrued, balance], unrounded. */
    private static function settle(Policy $policy, float $carry, float $taken, float $workHours): array
    {
        $full = $policy->accrualHours;
        $accrued = $full;

        if ($policy->mode === AccrualMode::All && $workHours > 0) {
            $accrued = max(0, $full * (1 - min($taken, $workHours) / $workHours));
        }

        $balance = $carry + $accrued - $taken;
        if ($policy->mode === AccrualMode::Unpaid && $balance < 0 && $workHours > 0) {
            // Solve for the unpaid hours u, where accrual shrinks by full/P per unpaid hour.
            $k = $full / $workHours;
            $unpaid = min(max(($taken - $carry - $full) / (1 - $k), 0), $workHours);
            $accrued = max(0, $full - $k * $unpaid);
        }

        return [$accrued, $carry + $accrued - $taken];
    }

    /**
     * Weekday hours in [a, b], less public holidays.
     *
     * @param  array<string, true>  $off  holidays keyed by Y-m-d
     */
    private static function workHours(Policy $policy, CarbonImmutable $a, CarbonImmutable $b, array $off): float
    {
        $days = 0;
        for ($d = $a; $d->lessThanOrEqualTo($b); $d = $d->addDay()) {
            if (! $d->isWeekend() && ! isset($off[$d->toDateString()])) {
                $days++;
            }
        }

        return $days * $policy->hoursPerDay;
    }

    /** Through the end of the year of today, the start, or the last leave, whichever is latest. */
    private static function horizon(CarbonImmutable $start, CarbonImmutable $today, array $sorted): CarbonImmutable
    {
        $last = $today->startOfDay()->max($start);
        if ($sorted !== []) {
            $last = $last->max(CarbonImmutable::parse(end($sorted)['date']));
        }

        return $last->endOfYear()->startOfDay();
    }

    private static function r2(float $x): float
    {
        // Math.round(x*100)/100 as in JS (half up, toward +infinity).
        return floor($x * 100 + 0.5) / 100;
    }
}
