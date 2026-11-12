<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLeaveRequest;
use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Services\Pto\CutOff;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * My leave: log, see and cancel your own leave, with your PTO balance and the current cut-off first.
 */
class LeaveController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $policy = Policy::current();
        $today = CarbonImmutable::today();
        $ledger = $user->ptoLedger($policy, $today);
        $current = collect($ledger)->first(fn (CutOff $c) => $c->contains($today)) ?? $ledger[0] ?? null;

        // Leave on a holiday stays on record but isn't charged or counted toward the month.
        $holidays = Holiday::names();
        $monthUsed = (float) $user->leaves()
            ->whereBetween('date', [$today->startOfMonth()->toDateString(), $today->endOfMonth()->toDateString()])
            ->whereNotIn('date', array_keys($holidays))
            ->sum('days');

        return Inertia::render('leave/index', [
            // Earned through the last payday: what the current cut-off starts with.
            'balance_hours' => $current?->startBalance ?? 0,
            'hours_per_day' => $policy->hoursPerDay,
            'current' => $current ? $this->cutOff($current, $user, $policy) : null,
            'month' => ['label' => $today->format('F'), 'used' => $monthUsed, 'cap' => $policy->monthlyCapDays],
            'leaves' => $user->leaves()->orderByDesc('date')->get()->map(fn (Leave $l) => [
                'id' => $l->id,
                'date' => $l->date->toDateString(),
                'days' => (float) $l->days,
                'part' => $l->part,
                'note' => $l->note,
                'locked' => $this->isLocked($l, $today),
                'holiday' => $holidays[$l->date->toDateString()] ?? null,
            ]),
            'history' => collect($ledger)
                ->filter(fn (CutOff $c) => $c->takenHours > 0 && $c->end->year === $today->year)
                ->reverse()->values()
                ->map(fn (CutOff $c) => $this->cutOff($c, $user, $policy)),
            'pto_start' => $user->ptoStart()->toDateString(),
        ]);
    }

    public function store(StoreLeaveRequest $request): RedirectResponse
    {
        $dates = $request->dates();

        DB::transaction(function () use ($request, $dates) {
            foreach ($dates as $date) {
                $request->user()->leaves()->create([
                    'date' => $date->toDateString(),
                    'days' => $request->daysEach(),
                    'part' => $request->part(),
                    'note' => $request->input('note'),
                ]);
            }
        });

        $days = count($dates) * $request->daysEach();
        Inertia::flash('toast', ['type' => 'success', 'message' => match (true) {
            $days === 0.5 => 'Half day logged.',
            $days === 1.0 => 'Leave logged for '.$dates[0]->format('M j').'.',
            default => (float) $days.' days logged.',
        }]);

        return to_route('leave.index');
    }

    public function destroy(Request $request, Leave $leave): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $own = $leave->user_id === $user->id;

        // Employees cancel their own leave until its cut-off ends; HR and admin can fix anything.
        abort_unless($user->can('hr') || ($own && ! $this->isLocked($leave, CarbonImmutable::today())), 403);

        $leave->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Leave on '.$leave->date->format('M j').' cancelled.']);

        return $own ? to_route('leave.index') : back();
    }

    private function isLocked(Leave $leave, CarbonImmutable $today): bool
    {
        return Ledger::cutOffFor(CarbonImmutable::parse($leave->date))[1]->lessThan($today);
    }

    /** @return array<string, mixed> */
    private function cutOff(CutOff $c, User $user, Policy $policy): array
    {
        return [
            'start' => $c->start->toDateString(),
            'end' => $c->end->toDateString(),
            'start_balance' => $c->startBalance,
            'accrued' => $c->accrued,
            'taken_hours' => $c->takenHours,
            'balance' => $c->balance,
            'deducted_hours' => $c->deductedHours,
            'deducted_pesos' => $user->daily_rate === null || $c->deductedHours == 0
                ? null
                : round($c->deductedHours / $policy->hoursPerDay * (float) $user->daily_rate, 2),
        ];
    }
}
