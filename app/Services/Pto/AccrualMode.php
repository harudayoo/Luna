<?php

namespace App\Services\Pto;

/**
 * How PTO accrues in a cut-off that has leave in it. One mode applies to the whole office.
 */
enum AccrualMode: string
{
    /** The full amount every cut-off, even on leave days. */
    case Full = 'full';

    /** PTO-covered days still earn PTO; unpaid hours earn nothing (accrual prorated). */
    case Unpaid = 'unpaid';

    /** Any leave hour earns nothing; accrual is prorated by hours actually worked. */
    case All = 'all';

    public function label(): string
    {
        return match ($this) {
            self::Full => 'Full accrual, even on leave',
            self::Unpaid => 'No accrual on unpaid hours',
            self::All => 'No accrual on any leave',
        };
    }
}
