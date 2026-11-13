<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayslipRequest;
use App\Models\LateLog;
use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayFrequency;
use App\Services\Payroll\PayRate;
use App\Services\Payroll\PaySchedule;
use App\Services\Payroll\PayslipMath;
use App\Services\Pto\CutOff;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payroll (HR): one payslip per person per pay period, a month or a cut-off (PaySchedule). The editor starts
 * from what Luna knows (the salary for the period, the PTO ledger's unpaid time off in it, last payslip's
 * deductions); HR fills in the rest.
 */
class PayrollController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['cutoff' => ['nullable', 'date_format:Y-m-d']]);
        $today = CarbonImmutable::today();
        [$start, $end] = PaySchedule::periodFor(CarbonImmutable::parse($request->input('cutoff', $today->toDateString())));

        // Only payslips of this exact period: a cut-off payslip made before a switch to monthly isn't the month's.
        $slips = Payslip::query()->where('period_start', $start->toDateString())
            ->where('period_end', $end->toDateString())->get()->keyBy('user_id');
        $rows = User::query()->orderBy('id')->get()
            ->filter(fn (User $u) => ! $u->isDeactivated() || $slips->has($u->id))
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'position' => $u->position,
                'has_salary' => $u->monthly_salary !== null,
                'payslip_id' => $slips->get($u->id)?->id,
                'net_pay' => $slips->has($u->id) ? (float) $slips->get($u->id)->net_pay : null,
                'released_on' => $slips->get($u->id)?->released_on?->toDateString(),
            ])->values();

        return Inertia::render('people/payroll', [
            'cutoff' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'prev' => PaySchedule::periodFor($start->subDay())[0]->toDateString(),
                'next' => $end->addDay()->toDateString(),
                'is_current' => $today->betweenIncluded($start, $end),
            ],
            'frequency' => PaySchedule::frequencyOn($start)->value,
            'rows' => $rows,
            'released' => $slips->filter(fn (Payslip $p) => $p->isReleased())->count(),
            'total_net' => round($slips->sum(fn (Payslip $p) => (float) $p->net_pay), 2),
        ]);
    }

    /** One person's payslips, newest first, past ones included: to check, re-release or re-print. */
    public function person(User $user): Response
    {
        return Inertia::render('people/payslips', [
            'person' => [
                'id' => $user->id,
                'name' => $user->name,
                'position' => $user->position,
                'has_salary' => $user->monthly_salary !== null,
            ],
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

    public function edit(User $user, string $cutoff): Response
    {
        [$start, $end] = $this->period($user, $cutoff);
        $saved = $user->payslips()->where('period_start', $start->toDateString())->first();
        [$unpaid, $unpaidExact] = $this->unpaidHours($user, $start, $end);
        [$lateHours, $latePesos] = LateLog::tardiness($user, $start, $end);
        $frequency = PaySchedule::frequencyOf($start, $end);
        // This month's daily rate (a pay period never spans two months): holiday pay and the payslip use it.
        $daily = PayRate::dailyFor($user, $start) ?? 0.0;

        if ($saved) {
            $inputs = collect(Payslip::INPUTS)->mapWithKeys(fn ($k) => [$k => (float) $saved->{$k}])->all();
            $issued = $saved->issued_on->toDateString();
        } else {
            $previous = $user->payslips()->where('period_start', '<', $start->toDateString())->orderByDesc('period_start')->first();
            $inputs = array_fill_keys(Payslip::INPUTS, 0.0);
            foreach (Payslip::RECURRING as $k) {
                $inputs[$k] = $previous ? (float) $previous->{$k} : 0.0;
            }
            // Per cut-off, the monthly deductions come off once a month, on the month-end cut-off: the
            // 1st-15th starts them at 0, and the 16th takes them from the last payslip that ended a month.
            if ($frequency === PayFrequency::SemiMonthly) {
                $monthEnd = $start->day === 1 ? null : ($user->payslips()->where('period_start', '<', $start->toDateString())
                    ->orderByDesc('period_start')->get()->first(fn (Payslip $p) => $p->period_end->isLastOfMonth()) ?? $previous);
                foreach (Payslip::MONTHLY_DEDUCTIONS as $k) {
                    $inputs[$k] = $monthEnd ? (float) $monthEnd->{$k} : 0.0;
                }
            }
            $inputs['absences'] = PayRate::forHours($user, $unpaidExact, Policy::current(), $start) ?? 0.0;
            // Declared lates (Time), at the same hourly rate, on their own line.
            $inputs['tardiness'] = $latePesos ?? 0.0;
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
            'frequency' => $frequency->value,
            'payslip' => $inputs + PayslipMath::totals((float) $user->monthly_salary, $daily, $inputs, $frequency->share()) + [
                'unpaid_hours' => $unpaid,
                'tardiness_hours' => $lateHours,
                'tardiness_due' => $latePesos ?? 0.0,
                'issued_on' => $issued,
            ],
            'saved' => $saved !== null,
            'payslip_id' => $saved?->id,
            'released_on' => $saved?->released_on?->toDateString(),
            'premiums' => [
                'regular' => PayslipMath::REGULAR_HOLIDAY_PREMIUM,
                'special' => PayslipMath::SPECIAL_HOLIDAY_PREMIUM,
            ],
        ]);
    }

    public function update(PayslipRequest $request, User $user, string $cutoff): RedirectResponse
    {
        [$start, $end] = $this->period($user, $cutoff);
        if ($user->monthly_salary === null) {
            throw ValidationException::withMessages([
                'monthly_salary' => "Set {$user->name}'s monthly salary first (People → Leave details).",
            ]);
        }

        if ($user->payslips()->where('period_start', $start->toDateString())->whereNotNull('released_on')->exists()) {
            throw ValidationException::withMessages([
                'released' => "{$user->name}'s pay for this period is marked as received. Undo the release first to change the payslip.",
            ]);
        }

        $inputs = $request->safe()->only(Payslip::INPUTS) + ['tardiness' => 0.0];
        $monthly = (float) $user->monthly_salary;
        $daily = PayRate::dailyFor($user, $start) ?? 0.0;

        Payslip::query()->updateOrCreate(
            ['user_id' => $user->id, 'period_start' => $start->toDateString()],
            $inputs + PayslipMath::totals($monthly, $daily, $inputs, PaySchedule::frequencyOf($start, $end)->share()) + [
                'period_end' => $end->toDateString(),
                'issued_on' => $request->input('issued_on'),
                'position' => $user->position,
                'monthly_salary' => $monthly,
                'daily_rate' => $daily,
                'unpaid_hours' => $this->unpaidHours($user, $start, $end)[0],
                'tardiness_hours' => LateLog::tardiness($user, $start, $end)[0],
                'created_by' => $request->user()->id,
            ],
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name}'s payslip saved."]);

        return to_route('people.payroll.edit', [$user, $start->toDateString()]);
    }

    /**
     * The pay period starting on $cutoff. A saved payslip keeps the period it was made in, even after the
     * pay schedule changed (an Aug 16-31 cut-off stays one once August counts as monthly).
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function period(User $user, string $cutoff): array
    {
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $cutoff) ?: null;
        $saved = $date === null ? null : $user->payslips()->where('period_start', $date->toDateString())->first();
        if ($saved) {
            return [$date, CarbonImmutable::createFromFormat('!Y-m-d', $saved->period_end->toDateString())];
        }
        $period = $date === null ? null : PaySchedule::periodFor($date);
        if ($period === null || ! $period[0]->equalTo($date)) {
            throw ValidationException::withMessages(['cutoff' => 'Pick a pay period: it starts on the 1st (or the 16th, when paid per cut-off).']);
        }

        return $period;
    }

    /**
     * The PTO ledger's unpaid hours in a pay period: its one cut-off, or both cut-offs of a month.
     * Returns [rounded to 2 decimals, exact]; pesos come from the exact hours, rounded once.
     *
     * @return array{0: float, 1: float}
     */
    private function unpaidHours(User $user, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $through = CarbonImmutable::today()->max($start->endOfYear());
        $exact = (float) collect($user->ptoLedger(Policy::current(), $through))
            ->filter(fn (CutOff $c) => $c->start->betweenIncluded($start, $end))
            ->sum(fn (CutOff $c) => $c->deductedHoursExact);

        return [round($exact, 2), $exact];
    }
}
