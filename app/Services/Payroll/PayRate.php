<?php

namespace App\Services\Payroll;

use App\Models\User;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;

/**
 * What a day and an hour cost for someone in a given month (user, 2026-11-13):
 * - a fixed daily rate HR set for the person wins;
 * - otherwise monthly salary ÷ that month's working days (WorkDays: every Mon-Fri, holidays included as paid days);
 * - people with neither fall back to their stored daily rate; with nothing, there is no figure.
 * An hour is the daily rate ÷ hours a day; pesos are rounded once, at the end.
 */
final class PayRate
{
    /** The daily rate for the month $on falls in, rounded to centavos; null without any rate. */
    public static function dailyFor(User $user, CarbonImmutable $on): ?float
    {
        $daily = self::exactDaily($user, $on);

        return $daily === null ? null : round($daily, 2);
    }

    public static function forHours(User $user, float $hours, Policy $policy, CarbonImmutable $on): ?float
    {
        $daily = self::exactDaily($user, $on);

        return $daily === null ? null : round($hours / $policy->hoursPerDay * $daily, 2);
    }

    public static function hasRate(User $user): bool
    {
        return $user->fixed_daily_rate !== null || $user->monthly_salary !== null || $user->daily_rate !== null;
    }

    private static function exactDaily(User $user, CarbonImmutable $on): ?float
    {
        if ($user->fixed_daily_rate !== null) {
            return (float) $user->fixed_daily_rate;
        }
        if ($user->monthly_salary !== null) {
            return (float) $user->monthly_salary / max(1, WorkDays::inMonth($on));
        }

        return $user->daily_rate === null ? null : (float) $user->daily_rate;
    }
}
