<?php

namespace App\Services\Payroll;

use Carbon\CarbonImmutable;

/**
 * Working days in a calendar month: every Monday to Friday (user, 2026-11-13). Holidays still count:
 * they are paid days, as the accountant treats them. A month's daily rate is the monthly salary ÷ this,
 * so it moves with 20-23 days.
 */
final class WorkDays
{
    public static function inMonth(CarbonImmutable $date): int
    {
        $last = $date->endOfMonth()->startOfDay();

        $days = 0;
        for ($d = $date->startOfMonth(); $d->lessThanOrEqualTo($last); $d = $d->addDay()) {
            if (! $d->isWeekend()) {
                $days++;
            }
        }

        return $days;
    }
}
