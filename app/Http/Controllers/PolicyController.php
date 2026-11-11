<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Services\Pto\AccrualMode;
use App\Services\Pto\Policy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The office PTO policy (HR): one set of rules for everyone, stored as settings.
 */
class PolicyController extends Controller
{
    public function edit(): Response
    {
        $policy = Policy::current();

        return Inertia::render('people/policy', [
            'policy' => [
                'accrual_mode' => $policy->mode->value,
                'accrual_hours' => $policy->accrualHours,
                'hours_per_day' => $policy->hoursPerDay,
                'monthly_cap_days' => $policy->monthlyCapDays,
                'office_started_on' => Policy::officeStartedOn()->toDateString(),
            ],
            'modes' => collect(AccrualMode::cases())->map(fn (AccrualMode $m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'accrual_mode' => ['required', Rule::enum(AccrualMode::class)],
            'accrual_hours' => ['required', 'numeric', 'min:0', 'max:40'],
            'monthly_cap_days' => ['required', 'numeric', 'min:0.5', 'max:31'],
            'office_started_on' => ['required', 'date_format:Y-m-d'],
        ]);

        Setting::put('pto.accrual_mode', $validated['accrual_mode']);
        Setting::put('pto.accrual_hours', $validated['accrual_hours']);
        Setting::put('pto.monthly_cap_days', $validated['monthly_cap_days']);
        Setting::put('office.started_on', $validated['office_started_on']);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Leave policy saved. Balances use it now.']);

        return to_route('people.policy');
    }
}
