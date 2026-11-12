<?php

namespace App\Services\Pto;

use Carbon\CarbonImmutable;

/**
 * One payroll cut-off (1st-15th or 16th-month end). Hours throughout.
 */
final readonly class CutOff
{
    /**
     * @param  list<array{date: string, days: float}>  $leaves  leave dated inside this cut-off
     */
    public function __construct(
        public CarbonImmutable $start,
        public CarbonImmutable $end,
        public float $startBalance,
        public float $accrued,
        public float $takenHours,
        /** Can be negative: the shortfall is unpaid. */
        public float $balance,
        public float $deductedHours,
        public array $leaves,
        /** The unpaid hours unrounded (16 - 6.6667 = 9.3333): pesos come from this, rounded once at the end. */
        public float $deductedHoursExact = 0.0,
    ) {}

    /** Payroll for it has run, so employees can't change its leave any more. */
    public function hasEnded(CarbonImmutable $today): bool
    {
        return $today->startOfDay()->greaterThan($this->end);
    }

    public function contains(CarbonImmutable $date): bool
    {
        return $date->betweenIncluded($this->start, $this->end);
    }
}
