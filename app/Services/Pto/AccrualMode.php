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

    /**
     * The office rule (accountant, 2026-11-12): any leave in a cut-off, even part of a day, forfeits
     * that whole cut-off's accrual. Leave on a holiday isn't charged, so it doesn't count.
     */
    case Forfeit = 'forfeit';

    public function label(): string
    {
        return match ($this) {
            self::Full => 'Full accrual, even on leave',
            self::Unpaid => 'No accrual on unpaid hours',
            self::All => 'No accrual on any leave',
            self::Forfeit => 'No accrual in a cut-off with leave',
        };
    }
}
