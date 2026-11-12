<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLeaveForRequest;
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
 * Leave & pay (HR): everyone's leave, balance and deduction for one cut-off.
 */
class TeamLeaveController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['cutoff' => ['nullable', 'date_format:Y-m-d']]);

        $today = CarbonImmutable::today();
        [$start, $end] = Ledger::cutOffFor(CarbonImmutable::parse($request->input('cutoff', $today->toDateString())));
        $policy = Policy::current();
        $holidays = Holiday::names($start->toDateString(), $end->toDateString());

        $rows = User::query()->orderBy('id')->get()->map(function (User $user) use ($policy, $today, $start, $end, $holidays) {
            // The ledger runs to the end of the later of today's or the viewed cut-off's year.
            $ledger = $user->ptoLedger($policy, $end->greaterThan($today) ? $end : $today);
            $c = collect($ledger)->first(fn (CutOff $c) => $c->start->equalTo($start));

            return [
                'id' => $user->id,
                'name' => $user->name,
                'started' => $c !== null,
                'start_balance' => $c?->startBalance ?? 0,
                'accrued' => $c?->accrued ?? 0,
                'taken_hours' => $c?->takenHours ?? 0,
                'balance' => $c?->balance ?? 0,
                'deducted_hours' => $c?->deductedHours ?? 0,
                'deducted_pesos' => $c && $c->deductedHours > 0 && $user->daily_rate !== null
                    ? round($c->deductedHours / $policy->hoursPerDay * (float) $user->daily_rate, 2)
                    : null,
                'has_rate' => $user->daily_rate !== null,
                'deactivated' => $user->isDeactivated(),
                'leaves' => $user->leaves()
                    ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                    ->orderBy('date')
                    ->get()
                    ->map(fn (Leave $l) => [
                        'id' => $l->id,
                        'date' => $l->date->toDateString(),
                        'days' => (float) $l->days,
                        'part' => $l->part,
                        'note' => $l->note,
                        'holiday' => $holidays[$l->date->toDateString()] ?? null,
                    ]),
            ];
        })
            // Someone deactivated only shows up for a cut-off they had leave in.
            ->reject(fn (array $row) => $row['deactivated'] && $row['leaves']->isEmpty())
            ->values();

        return Inertia::render('people/leave', [
            'cutoff' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'prev' => Ledger::cutOffFor($start->subDay())[0]->toDateString(),
                'next' => $end->addDay()->toDateString(),
                'ended' => $end->lessThan($today),
                'is_current' => $today->betweenIncluded($start, $end),
                'holidays' => collect($holidays)->map(fn ($name, $date) => ['date' => $date, 'name' => $name])->values(),
            ],
            'rows' => $rows,
            'totals' => [
                'taken_hours' => round($rows->sum('taken_hours'), 2),
                'deducted_hours' => round($rows->sum('deducted_hours'), 2),
                'deducted_pesos' => round($rows->sum(fn ($r) => $r['deducted_pesos'] ?? 0), 2),
            ],
        ]);
    }

    /** HR logs leave for someone, past cut-offs included (to fix the record), then shows that cut-off. */
    public function store(StoreLeaveForRequest $request, User $user): RedirectResponse
    {
        $dates = $request->dates();

        DB::transaction(function () use ($request, $user, $dates) {
            foreach ($dates as $date) {
                $user->leaves()->create([
                    'date' => $date->toDateString(),
                    'days' => $request->daysEach(),
                    'part' => $request->part(),
                    'note' => $request->input('note'),
                ]);
            }
        });

        $days = count($dates) * $request->daysEach();
        Inertia::flash('toast', ['type' => 'success', 'message' => sprintf(
            '%s %s logged for %s.',
            $days === 0.5 ? 'Half a' : (float) $days,
            $days > 1 ? 'days' : 'day',
            explode(' ', $user->name)[0],
        )]);

        return to_route('people.leave', ['cutoff' => Ledger::cutOffFor($dates[0])[0]->toDateString()]);
    }
}
