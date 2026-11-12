<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * HR saving a payslip. Amounts are pesos, never negative; holiday days are the holidays the person
 * worked in the cut-off (halves allowed).
 */
class PayslipRequest extends FormRequest
{
    public function rules(): array
    {
        $money = ['required', 'numeric', 'min:0', 'max:10000000'];
        $days = ['required', 'numeric', 'min:0', 'max:16', 'multiple_of:0.5'];

        return [
            'issued_on' => ['required', 'date_format:Y-m-d'],
            'holiday_regular_days' => $days,
            'holiday_special_days' => $days,
            'absences' => $money,
            'overtime_allowance' => $money,
            'sss' => $money,
            'philhealth' => $money,
            'pagibig' => $money,
            'withholding_tax' => $money,
            'cash_advance' => $money,
        ];
    }
}
