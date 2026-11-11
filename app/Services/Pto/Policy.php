<?php

namespace App\Services\Pto;

use App\Models\Setting;

/**
 * The office-wide PTO rules. Defaults live in config/luna.php; HR overrides are stored as
 * settings ("pto.*") and apply to everyone.
 */
final readonly class Policy
{
    public function __construct(
        public float $accrualHours,
        public float $hoursPerDay,
        public AccrualMode $mode,
        public float $monthlyCapDays,
    ) {}

    public static function current(): self
    {
        $defaults = config('luna.pto');

        return new self(
            accrualHours: (float) Setting::get('pto.accrual_hours', $defaults['accrual_hours']),
            hoursPerDay: (float) Setting::get('pto.hours_per_day', $defaults['hours_per_day']),
            mode: AccrualMode::tryFrom((string) Setting::get('pto.accrual_mode', $defaults['accrual_mode'])) ?? AccrualMode::Full,
            monthlyCapDays: (float) Setting::get('pto.monthly_cap_days', $defaults['monthly_cap_days']),
        );
    }
}
