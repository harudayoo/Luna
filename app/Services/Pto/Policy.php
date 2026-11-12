<?php

namespace App\Services\Pto;

use App\Models\Setting;
use Carbon\CarbonImmutable;

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
        /** The pay basis (setting "pay.work_days_per_year"): monthly x 12 / this is the daily rate. */
        public float $workDaysPerYear = 260,
    ) {}

    /** Pesos per hour from a monthly salary, unrounded: monthly x 12 / work days a year / hours a day. */
    public function hourlyRate(float $monthly): float
    {
        return $monthly * 12 / $this->workDaysPerYear / $this->hoursPerDay;
    }

    /** When office operations began (setting "office.started_on", default in config/luna.php). */
    public static function officeStartedOn(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) Setting::get('office.started_on', config('luna.office.started_on')))->startOfDay();
    }

    public static function current(): self
    {
        $defaults = config('luna.pto');

        return new self(
            accrualHours: (float) Setting::get('pto.accrual_hours', $defaults['accrual_hours']),
            hoursPerDay: (float) Setting::get('pto.hours_per_day', $defaults['hours_per_day']),
            mode: AccrualMode::tryFrom((string) Setting::get('pto.accrual_mode', $defaults['accrual_mode'])) ?? AccrualMode::Full,
            monthlyCapDays: (float) Setting::get('pto.monthly_cap_days', $defaults['monthly_cap_days']),
            workDaysPerYear: (float) Setting::get('pay.work_days_per_year', config('luna.pay.work_days_per_year')),
        );
    }
}
