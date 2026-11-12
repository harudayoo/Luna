<?php

namespace App\Http\Controllers;

use App\Models\Payslip;
use App\Services\Payroll\PaySchedule;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payroll release (HR): on payday, record that each person received their pay, and print the Payroll
 * Release Form they sign. A released payslip is locked (PayrollController::update) until it's undone.
 */
class PayrollReleaseController extends Controller
{
    /** Mark one payslip received (on a given day, today by default), or undo it. */
    public function update(Request $request, Payslip $payslip): RedirectResponse
    {
        $data = $request->validate([
            'released' => ['required', 'boolean'],
            'released_on' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $name = $payslip->user->name;

        if ($data['released']) {
            $payslip->update([
                'released_on' => $data['released_on'] ?? CarbonImmutable::today()->toDateString(),
                'released_by' => $request->user()->id,
            ]);
            Inertia::flash('toast', ['type' => 'success', 'message' => "{$name}'s pay marked as received."]);
        } else {
            $payslip->update(['released_on' => null, 'released_by' => null]);
            Inertia::flash('toast', ['type' => 'success', 'message' => "Release undone. {$name}'s payslip can be edited again."]);
        }

        return back();
    }

    /** Mark every payslip of the pay period received today; ones already released keep their date. */
    public function store(Request $request): RedirectResponse
    {
        [$start] = $this->cutoff($request);

        $count = Payslip::query()
            ->where('period_start', $start->toDateString())
            ->whereNull('released_on')
            ->get()
            ->each(fn (Payslip $p) => $p->update([
                'released_on' => CarbonImmutable::today()->toDateString(),
                'released_by' => $request->user()->id,
            ]))
            ->count();

        Inertia::flash('toast', ['type' => 'success', 'message' => $count === 1
            ? '1 payslip marked as received.'
            : "{$count} payslips marked as received."]);

        return back();
    }

    /** The Payroll Release Form: every payslip of the pay period, a line each to sign. */
    public function print(Request $request): Response
    {
        [$start, $end] = $this->cutoff($request);
        $paper = $request->validate([
            'paper' => ['nullable', 'in:'.implode(',', array_keys(PayslipController::PAPERS))],
        ])['paper'] ?? 'letter';

        $slips = Payslip::query()->with('user')->where('period_start', $start->toDateString())->get()
            ->sortBy(fn (Payslip $p) => mb_strtolower($p->user->name))->values();
        $sum = fn (string $k) => round($slips->sum(fn (Payslip $p) => (float) $p->{$k}), 2);

        return Inertia::render('print/payroll-release', [
            'paper' => $paper,
            'papers' => collect(PayslipController::PAPERS)->map(fn ($p, $key) => $p + ['value' => $key])->values(),
            'company' => PayslipController::COMPANY,
            'back' => route('people.payroll', ['cutoff' => $start->toDateString()]),
            'period' => ['start' => $start->toDateString(), 'end' => $end->toDateString()],
            'printed_on' => CarbonImmutable::today()->toDateString(),
            'prepared_by' => $request->user()->name,
            'rows' => $slips->map(fn (Payslip $p) => [
                'id' => $p->id,
                'name' => $p->user->name,
                'position' => $p->position,
                'gross_pay' => (float) $p->gross_pay,
                'total_deductions' => (float) $p->total_deductions,
                'net_pay' => (float) $p->net_pay,
                'released_on' => $p->released_on?->toDateString(),
            ]),
            // Each payslip too, printed after the form two to a sheet (top and bottom halves) to save paper.
            'payslips' => $slips->map(fn (Payslip $p) => PayslipController::document($p)),
            'totals' => [
                'gross_pay' => $sum('gross_pay'),
                'total_deductions' => $sum('total_deductions'),
                'net_pay' => $sum('net_pay'),
            ],
        ]);
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function cutoff(Request $request): array
    {
        $request->validate(['cutoff' => ['required', 'date_format:Y-m-d']]);

        return PaySchedule::periodFor(CarbonImmutable::parse($request->input('cutoff')));
    }
}
