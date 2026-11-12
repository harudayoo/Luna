<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayslipRequest;
use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use App\Services\Pto\CutOff;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payroll (HR): one payslip per person per cut-off. The editor starts from what Luna knows (half the
 * monthly salary, the PTO ledger's unpaid time off, last payslip's deductions); HR fills in the rest.
 */
class PayrollController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['cutoff' => ['nullable', 'date_format:Y-m-d']]);
        $today = CarbonImmutable::today();
        [$start, $end] = Ledger::cutOffFor(CarbonImmutable::parse($request->input('cutoff', $today->toDateString())));

        $slips = Payslip::query()->where('period_start', $start->toDateString())->get()->keyBy('user_id');
        $rows = User::query()->orderBy('id')->get()
            ->filter(fn (User $u) => ! $u->isDeactivated() || $slips->has($u->id))
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'position' => $u->position,
                'has_salary' => $u->monthly_salary !== null,
                'payslip_id' => $slips->get($u->id)?->id,
                'net_pay' => $slips->has($u->id) ? (float) $slips->get($u->id)->net_pay : null,
            ])->values();

        return Inertia::render('people/payroll', [
            'cutoff' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'prev' => Ledger::cutOffFor($start->subDay())[0]->toDateString(),
                'next' => $end->addDay()->toDateString(),
                'is_current' => $today->betweenIncluded($start, $end),
            ],
            'rows' => $rows,
            'total_net' => round($slips->sum(fn (Payslip $p) => (float) $p->net_pay), 2),
        ]);
    }

    public function edit(User $user, string $cutoff): Response
    {
        [$start, $end] = $this->period($cutoff);
        $saved = $user->payslips()->where('period_start', $start->toDateString())->first();
        $unpaid = $this->unpaidHours($user, $start);
        $daily = (float) $user->daily_rate;

        if ($saved) {
            $inputs = collect(Payslip::INPUTS)->mapWithKeys(fn ($k) => [$k => (float) $saved->{$k}])->all();
            $issued = $saved->issued_on->toDateString();
        } else {
            $previous = $user->payslips()->where('period_start', '<', $start->toDateString())->orderByDesc('period_start')->first();
            $inputs = array_fill_keys(Payslip::INPUTS, 0.0);
            foreach (Payslip::RECURRING as $k) {
                $inputs[$k] = $previous ? (float) $previous->{$k} : 0.0;
            }
            $inputs['absences'] = round($unpaid / Policy::current()->hoursPerDay * $daily, 2);
            $issued = CarbonImmutable::today()->toDateString();
        }

        return Inertia::render('people/payslip', [
            'person' => [
                'id' => $user->id,
                'name' => $user->name,
                'position' => $user->position,
                'monthly_salary' => $user->monthly_salary === null ? null : (float) $user->monthly_salary,
                'daily_rate' => $daily,
            ],
            'period' => ['start' => $start->toDateString(), 'end' => $end->toDateString()],
            'payslip' => $inputs + PayslipMath::totals((float) $user->monthly_salary, $daily, $inputs) + [
                'unpaid_hours' => $unpaid,
                'issued_on' => $issued,
            ],
            'saved' => $saved !== null,
            'payslip_id' => $saved?->id,
            'premiums' => [
                'regular' => PayslipMath::REGULAR_HOLIDAY_PREMIUM,
                'special' => PayslipMath::SPECIAL_HOLIDAY_PREMIUM,
            ],
        ]);
    }

    public function update(PayslipRequest $request, User $user, string $cutoff): RedirectResponse
    {
        [$start, $end] = $this->period($cutoff);
        if ($user->monthly_salary === null) {
            throw ValidationException::withMessages([
                'monthly_salary' => "Set {$user->name}'s monthly salary first (People → Leave details).",
            ]);
        }

        $inputs = $request->safe()->only(Payslip::INPUTS);
        $monthly = (float) $user->monthly_salary;
        $daily = (float) $user->daily_rate;

        Payslip::query()->updateOrCreate(
            ['user_id' => $user->id, 'period_start' => $start->toDateString()],
            $inputs + PayslipMath::totals($monthly, $daily, $inputs) + [
                'period_end' => $end->toDateString(),
                'issued_on' => $request->input('issued_on'),
                'position' => $user->position,
                'monthly_salary' => $monthly,
                'daily_rate' => $daily,
                'unpaid_hours' => $this->unpaidHours($user, $start),
                'created_by' => $request->user()->id,
            ],
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name}'s payslip saved. They can see it now."]);

        return to_route('people.payroll.edit', [$user, $start->toDateString()]);
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function period(string $cutoff): array
    {
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $cutoff) ?: null;
        if ($date === null || ! in_array($date->day, [1, 16], true)) {
            throw ValidationException::withMessages(['cutoff' => 'Pick a cut-off: it starts on the 1st or the 16th.']);
        }

        return Ledger::cutOffFor($date);
    }

    /** The PTO ledger's unpaid hours for the cut-off starting on $start. */
    private function unpaidHours(User $user, CarbonImmutable $start): float
    {
        $through = CarbonImmutable::today()->max($start->endOfYear());
        $c = collect($user->ptoLedger(Policy::current(), $through))->first(fn (CutOff $c) => $c->start->equalTo($start));

        return $c?->deductedHours ?? 0.0;
    }
}
