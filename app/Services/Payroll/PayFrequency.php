<?php

namespace App\Services\Payroll;

/**
 * How often pay is calculated and released. PTO is per cut-off either way (Ledger); only the payslip's
 * period and basic pay follow this.
 */
enum PayFrequency: string
{
    /** One payslip a month (1st to month end), released at month end: the office's way since Aug 2026. */
    case Monthly = 'monthly';

    /** One payslip per cut-off (1st-15th, 16th-month end), released on the 15th and the month end. */
    case SemiMonthly = 'semi_monthly';

    public function label(): string
    {
        return match ($this) {
            self::Monthly => 'Monthly (month end)',
            self::SemiMonthly => 'Per cut-off (15th and month end)',
        };
    }

    /** The part of the monthly salary one payslip pays as basic. */
    public function share(): float
    {
        return $this === self::Monthly ? 1.0 : 0.5;
    }
}
