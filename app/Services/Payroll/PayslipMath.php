<?php

namespace App\Services\Payroll;

/**
 * The payslip arithmetic, in one place. Pay is a fixed monthly salary paid per cut-off (half each).
 *
 * - Holiday pay: the premium for working a holiday, on top of the day already paid in the monthly
 *   salary: 100% of the daily rate for a regular holiday, 30% for a special non-working day.
 * - Gross = basic + holiday pay + overtime/allowance - absences (unpaid time off).
 * - Net = gross - (SSS + PhilHealth + Pag-IBIG + withholding tax + cash advance/loan).
 *
 * Government deductions are entered by HR (from the accountant), not computed here.
 */
final class PayslipMath
{
    public const WORK_DAYS_PER_MONTH = 22;

    public const REGULAR_HOLIDAY_PREMIUM = 1.0;

    public const SPECIAL_HOLIDAY_PREMIUM = 0.3;

    public static function dailyRate(float $monthly): float
    {
        return round($monthly / self::WORK_DAYS_PER_MONTH, 2);
    }

    /**
     * @param  array<string, float|int|string|null>  $in  the Payslip::INPUTS values
     * @return array<string, float> basic_pay, holiday_pay, gross_pay, total_deductions, net_pay
     */
    public static function totals(float $monthly, float $daily, array $in): array
    {
        $n = fn (string $k) => (float) ($in[$k] ?? 0);

        $basic = round($monthly / 2, 2);
        $holiday = round($daily * ($n('holiday_regular_days') * self::REGULAR_HOLIDAY_PREMIUM
            + $n('holiday_special_days') * self::SPECIAL_HOLIDAY_PREMIUM), 2);
        $gross = round($basic + $holiday + $n('overtime_allowance') - $n('absences'), 2);
        $deductions = round($n('sss') + $n('philhealth') + $n('pagibig') + $n('withholding_tax') + $n('cash_advance'), 2);

        return [
            'basic_pay' => $basic,
            'holiday_pay' => $holiday,
            'gross_pay' => $gross,
            'total_deductions' => $deductions,
            'net_pay' => round($gross - $deductions, 2),
        ];
    }
}
