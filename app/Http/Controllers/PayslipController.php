<?php

namespace App\Http\Controllers;

use App\Models\Payslip;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payslips as documents (HR and admin only): their own list, and anyone's printable payslip, on a
 * whole sheet of the chosen paper. The release form prints them at half size, two to a sheet.
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
                'released_on' => $p->released_on?->toDateString(),
            ]),
        ]);
    }

    public function print(Request $request, Payslip $payslip): Response
    {
        // HR and admin only (routes/modules/payslips.php).
        $paper = $request->validate(['paper' => ['nullable', 'in:'.implode(',', array_keys(self::PAPERS))]])['paper'] ?? 'letter';

        return Inertia::render('print/payslip', [
            'paper' => $paper,
            'papers' => collect(self::PAPERS)->map(fn ($p, $key) => $p + ['value' => $key])->values(),
            'company' => self::COMPANY,
            'back' => route('people.payroll', ['cutoff' => $payslip->period_start->toDateString()]),
            'payslip' => self::document($payslip),
        ]);
    }

    /** Everything the printed payslip shows (PayslipData on the page). */
    public static function document(Payslip $payslip): array
    {
        $money = fn (string $k) => (float) $payslip->{$k};

        return [
            'id' => $payslip->id,
            'name' => $payslip->user->name,
            'position' => $payslip->position,
            'start' => $payslip->period_start->toDateString(),
            'end' => $payslip->period_end->toDateString(),
            'issued_on' => $payslip->issued_on->toDateString(),
            'holiday_regular_days' => $money('holiday_regular_days'),
            'holiday_special_days' => $money('holiday_special_days'),
            'unpaid_hours' => $money('unpaid_hours'),
            'tardiness_hours' => $money('tardiness_hours'),
        ] + collect([
            'monthly_salary', 'daily_rate', 'basic_pay', 'holiday_pay', 'absences', 'tardiness', 'overtime_allowance', 'gross_pay',
            'sss', 'philhealth', 'pagibig', 'withholding_tax', 'cash_advance', 'total_deductions', 'net_pay',
        ])->mapWithKeys(fn ($k) => [$k => $money($k)])->all();
    }
}
