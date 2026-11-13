<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A payslip for one person and one cut-off. Amounts are pesos (decimal strings); the pay details
 * (position, salary, rate) are copied in when saved. Totals come from App\Services\Payroll\PayslipMath.
 *
 * @property int $id
 * @property int $user_id
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property Carbon $issued_on
 * @property Carbon|null $released_on
 * @property int|null $released_by
 * @property string|null $position
 * @property string $monthly_salary
 * @property string $daily_rate
 * @property string $basic_pay
 * @property string $holiday_regular_days
 * @property string $holiday_special_days
 * @property string $holiday_pay
 * @property string $unpaid_hours
 * @property string $absences
 * @property string $overtime_allowance
 * @property string $gross_pay
 * @property string $sss
 * @property string $philhealth
 * @property string $pagibig
 * @property string $withholding_tax
 * @property string $cash_advance
 * @property string $total_deductions
 * @property string $net_pay
 */
class Payslip extends Model
{
    /** Amounts HR types in; everything else is copied or computed. */
    public const INPUTS = [
        'holiday_regular_days', 'holiday_special_days', 'absences', 'overtime_allowance',
        'sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance',
    ];

    /** Carried over from the previous payslip as the starting point. */
    public const RECURRING = ['sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance', 'overtime_allowance'];

    /** Taken once a month: per cut-off, only on the month-end payslip (PayrollController::edit). */
    public const MONTHLY_DEDUCTIONS = ['sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return array_fill_keys([
            'monthly_salary', 'daily_rate', 'basic_pay', 'holiday_pay', 'absences', 'overtime_allowance', 'gross_pay',
            'sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance', 'total_deductions', 'net_pay', 'unpaid_hours',
        ], 'decimal:2') + [
            'holiday_regular_days' => 'decimal:1',
            'holiday_special_days' => 'decimal:1',
        ];
    }

    /*
     * Dates are stored as a plain Y-m-d on every driver (as on Leave), so lookups by date string
     * are exact: a "date" cast writes "Y-m-d 00:00:00" on SQLite.
     */
    protected function periodStart(): Attribute
    {
        return self::ymd();
    }

    protected function periodEnd(): Attribute
    {
        return self::ymd();
    }

    protected function issuedOn(): Attribute
    {
        return self::ymd();
    }

    protected function releasedOn(): Attribute
    {
        return self::ymd();
    }

    private static function ymd(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null ? null : Carbon::parse($value)->startOfDay(),
            set: fn (mixed $value) => $value === null ? null : Carbon::parse($value)->toDateString(),
        );
    }

    public function isReleased(): bool
    {
        return $this->released_on !== null;
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
