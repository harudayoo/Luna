<?php

namespace App\Services\Pto;

use Carbon\CarbonImmutable;

/**
 * The PTO ledger: a port of the old single-file planner's engine (index.html: startPeriod,
 * horizon, workHours, settle, buildSemi), kept step for step so figures match it exactly.
 * tests/Unit/PtoLedgerTest pins it to golden values produced by that original code.
 *
 * Each cut-off: carry + accrued - taken. A negative balance is unpaid (deducted from that
 * payroll) and the next cut-off starts from zero.
 */
final class Ledger
{
    /** Safety stop, as in the planner. */
    private const MAX_CUT_OFFS = 2400;

    /**
     * @param  iterable<array{date: string, days: float|int|string}>  $leaves
     * @return list<CutOff>
     */
    public static function build(Policy $policy, CarbonImmutable $start, float $openingHours, iterable $leaves, CarbonImmutable $today): array
    {
        $sorted = [];
        foreach ($leaves as $leave) {
            $sorted[] = ['date' => substr((string) $leave['date'], 0, 10), 'days' => (float) $leave['days']];
        }
        usort($sorted, fn ($a, $b) => strcmp($a['date'], $b['date']));

        [$period] = self::cutOffFor($start);
        $horizon = self::horizon($period, $today, $sorted);

        $out = [];
        $carry = self::r2($openingHours);
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
            [$accrued, $balance, $deducted] = self::settle($policy, $carry, $taken, self::workHours($policy, $period, $end));

            $out[] = new CutOff($period, $end, $carry, $accrued, $taken, $balance, $deducted, $inside);

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

    /** Hours due in a cut-off, the planner's settle(): returns [accrued, balance, deducted]. */
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

        $accrued = self::r2($accrued);
        $balance = self::r2($carry + $accrued - $taken);

        return [$accrued, $balance, $balance < 0 ? self::r2(-$balance) : 0.0];
    }

    /** Weekday hours in [a, b]. Public holidays aren't excluded yet (holiday calendar slice). */
    private static function workHours(Policy $policy, CarbonImmutable $a, CarbonImmutable $b): float
    {
        $days = 0;
        for ($d = $a; $d->lessThanOrEqualTo($b); $d = $d->addDay()) {
            if (! $d->isWeekend()) {
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
