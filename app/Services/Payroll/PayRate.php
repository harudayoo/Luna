<?php

namespace App\Services\Payroll;

use App\Models\User;
use App\Services\Pto\Policy;

/**
 * What unpaid hours cost, the accountant's way: monthly x 12 / work days a year / hours a day
 * (monthly / 173.33 at 260 days), rounded once at the end. People without a monthly salary
 * fall back to their stored daily rate; with neither, there is no figure.
 */
final class PayRate
{
    public static function forHours(User $user, float $hours, Policy $policy): ?float
    {
        if ($user->monthly_salary !== null) {
            return round($hours * $policy->hourlyRate((float) $user->monthly_salary), 2);
        }

        if ($user->daily_rate !== null) {
            return round($hours / $policy->hoursPerDay * (float) $user->daily_rate, 2);
        }

        return null;
    }
}
