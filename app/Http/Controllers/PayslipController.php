<?php

namespace App\Http\Controllers;

use App\Models\Payslip;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payslips as documents: your own list, and the printable payslip (yours, or anyone's for HR).
 * The payslip prints on the crosswise half of the chosen paper.
 */
class PayslipController extends Controller
{
    /** Width × height in inches, portrait. The payslip uses the full width and half the height. */
    public const PAPERS = [
        'letter' => ['label' => 'Letter (8.5 × 11 in)', 'w' => 8.5, 'h' => 11],
        'a4' => ['label' => 'A4 (210 × 297 mm)', 'w' => 8.27, 'h' => 11.69],
        'legal' => ['label' => 'Legal (8.5 × 14 in)', 'w' => 8.5, 'h' => 14],
        'long' => ['label' => 'Long / Folio (8.5 × 13 in)', 'w' => 8.5, 'h' => 13],
    ];

    public const COMPANY = [
        'name' => 'Orchid City Software OPC',
        'address' => 'NJ BLDG., P. Gomez St., Biasong, Dipolog City',
    ];

    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('payslips/index', [
            'payslips' => $user->payslips()->orderByDesc('period_start')->get()->map(fn (Payslip $p) => [
                'id' => $p->id,
                'start' => $p->period_start->toDateString(),
                'end' => $p->period_end->toDateString(),
                'issued_on' => $p->issued_on->toDateString(),
                'net_pay' => (float) $p->net_pay,
            ]),
        ]);
    }

    public function print(Request $request, Payslip $payslip): Response
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->can('hr') || $payslip->user_id === $user->id, 403);
        $paper = $request->validate(['paper' => ['nullable', 'in:'.implode(',', array_keys(self::PAPERS))]])['paper'] ?? 'letter';

        $money = fn (string $k) => (float) $payslip->{$k};

        return Inertia::render('print/payslip', [
            'paper' => $paper,
            'papers' => collect(self::PAPERS)->map(fn ($p, $key) => $p + ['value' => $key])->values(),
            'company' => self::COMPANY,
            'back' => $user->can('hr') ? route('people.payroll', ['cutoff' => $payslip->period_start->toDateString()]) : route('payslips.index'),
            'payslip' => [
                'id' => $payslip->id,
                'name' => $payslip->user->name,
                'position' => $payslip->position,
                'start' => $payslip->period_start->toDateString(),
                'end' => $payslip->period_end->toDateString(),
                'issued_on' => $payslip->issued_on->toDateString(),
                'holiday_regular_days' => $money('holiday_regular_days'),
                'holiday_special_days' => $money('holiday_special_days'),
                'unpaid_hours' => $money('unpaid_hours'),
            ] + collect([
                'monthly_salary', 'daily_rate', 'basic_pay', 'holiday_pay', 'absences', 'overtime_allowance', 'gross_pay',
                'sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance', 'total_deductions', 'net_pay',
            ])->mapWithKeys(fn ($k) => [$k => $money($k)])->all(),
        ]);
    }
}
