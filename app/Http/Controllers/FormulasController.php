<?php

namespace App\Http\Controllers;

use App\Services\Payroll\PayFrequency;
use App\Services\Payroll\PaySchedule;
use App\Services\Payroll\PayslipMath;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Formulas (HR and admin): how Luna works out PTO and pay, with the figures in force, and how often pay is
 * released (monthly or per cut-off, from a month HR picks).
 */
class FormulasController extends Controller
{
    public function show(): Response
    {
        $policy = Policy::current();
        $today = CarbonImmutable::today();
        $frequency = PaySchedule::frequencyOn($today);
        $changes = PaySchedule::changes();

        return Inertia::render('people/formulas', [
            'policy' => [
                'accrual_mode' => $policy->mode->value,
                'accrual_label' => $policy->mode->label(),
                'accrual_hours' => $policy->accrualHours,
                'hours_per_day' => $policy->hoursPerDay,
                'work_days_per_year' => $policy->workDaysPerYear,
            ],
            'premiums' => [
                'regular' => PayslipMath::REGULAR_HOLIDAY_PREMIUM,
                'special' => PayslipMath::SPECIAL_HOLIDAY_PREMIUM,
            ],
            'frequency' => $frequency->value,
            'default_frequency' => PaySchedule::default()->value,
            // Every change, so HR sees when each frequency started (and any change still to come).
            'schedule' => collect($changes)->map(fn (array $c) => [
                'from' => $c['from'],
                'frequency' => $c['frequency'],
                'upcoming' => $c['from'] > $today->toDateString(),
            ])->values(),
            'frequencies' => collect(PayFrequency::cases())->map(fn (PayFrequency $f) => [
                'value' => $f->value,
                'label' => $f->label(),
            ]),
            'next_month' => $today->addMonthNoOverflow()->format('Y-m'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'frequency' => ['required', Rule::enum(PayFrequency::class)],
            'from' => ['required', 'date_format:Y-m'],
        ]);
        $frequency = PayFrequency::from($data['frequency']);

        PaySchedule::change($frequency, $data['from']);

        $month = CarbonImmutable::createFromFormat('!Y-m', $data['from'])->format('F Y');
        Inertia::flash('toast', ['type' => 'success', 'message' => "Pay is {$frequency->label()} from {$month}."]);

        return to_route('people.formulas');
    }
}
