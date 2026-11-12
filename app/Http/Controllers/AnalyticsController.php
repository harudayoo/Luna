<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Services\Payroll\PayRate;
use App\Services\Pto\CutOff;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Analytics for one year: your own PTO (everyone) and, for HR, the office's leave trends, payroll
 * deductions and the next 30 days of absences. Figures come from the PTO ledger, so they always
 * agree with My leave and Leave & pay. Leave on a holiday never counts.
 */
class AnalyticsController extends Controller
{
    private const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    private const UPCOMING_DAYS = 30;

    public function index(Request $request): Response
    {
        $request->validate(['year' => ['nullable', 'integer', 'between:2000,2100']]);

        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $year = (int) $request->input('year', $today->year);
        $policy = Policy::current();
        $holidays = array_keys(Holiday::names());
        // The ledger runs to the end of "today's" year; for a later year, run it that far.
        $through = $today->max(CarbonImmutable::create($year, 12, 31));

        $props = [
            'year' => $year,
            'years' => $this->years($today),
            'me' => $this->mine($user, $policy, $year, $today, $through, $holidays),
        ];

        if ($user->can('hr')) {
            $props['office'] = $this->office($policy, $year, $today, $through, $holidays);
        }

        return Inertia::render('analytics/index', $props);
    }

    /** @param list<string> $holidays */
    private function mine(User $user, Policy $policy, int $year, CarbonImmutable $today, CarbonImmutable $through, array $holidays): array
    {
        $ledger = $user->ptoLedger($policy, $through);
        $current = collect($ledger)->first(fn (CutOff $c) => $c->contains($today));
        $cutoffs = $this->cutOffsIn($ledger, $year)->map(fn (CutOff $c) => [
            'start' => $c->start->toDateString(),
            'end' => $c->end->toDateString(),
            'balance' => $c->balance,
            'taken_hours' => $c->takenHours,
            'deducted_hours' => $c->deductedHours,
            'deducted_pesos' => $this->pesos($c->deductedHoursExact, $user, $policy),
        ]);

        return [
            'balance_hours' => $current?->startBalance ?? 0,
            'hours_per_day' => $policy->hoursPerDay,
            // Leave by the hour makes fractions of a day; day totals are shown to 2 decimals.
            'taken_days' => round($this->leavesIn($year, $holidays)->where('user_id', $user->id)->sum('days'), 2),
            'unpaid_hours' => round($cutoffs->sum('deducted_hours'), 2),
            'unpaid_pesos' => $user->daily_rate === null ? null : round($cutoffs->sum('deducted_pesos'), 2),
            'cutoffs' => $cutoffs->values(),
        ];
    }

    /** @param list<string> $holidays */
    private function office(Policy $policy, int $year, CarbonImmutable $today, CarbonImmutable $through, array $holidays): array
    {
        $leaves = $this->leavesIn($year, $holidays);
        $byUser = $leaves->groupBy('user_id');

        $months = collect(range(1, 12))->map(fn (int $m) => [
            'month' => sprintf('%d-%02d', $year, $m),
            'days' => round($leaves->filter(fn (Leave $l) => $l->date->month === $m)->sum('days'), 2),
        ]);
        $weekdays = collect(self::WEEKDAYS)->map(fn (string $day, int $i) => [
            'day' => $day,
            'days' => round($leaves->filter(fn (Leave $l) => $l->date->dayOfWeekIso === $i + 1)->sum('days'), 2),
        ]);

        // Everyone active, plus anyone deactivated who has leave this year.
        $people = User::query()->orderBy('name')->get()
            ->filter(fn (User $u) => ! $u->isDeactivated() || $byUser->has($u->id))
            ->map(function (User $u) use ($policy, $through, $year, $byUser) {
                $cutoffs = $this->cutOffsIn($u->ptoLedger($policy, $through), $year);

                return [
                    'user' => $u,
                    'cutoffs' => $cutoffs,
                    'row' => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'days' => round($byUser->get($u->id)?->sum('days') ?? 0, 2),
                        'deducted_hours' => round($cutoffs->sum(fn (CutOff $c) => $c->deductedHours), 2),
                        'deducted_pesos' => $u->daily_rate === null ? null
                            : round($cutoffs->sum(fn (CutOff $c) => $this->pesos($c->deductedHoursExact, $u, $policy)), 2),
                        'has_rate' => $u->daily_rate !== null,
                    ],
                ];
            });

        $cutoffs = $people
            ->flatMap(fn (array $p) => $p['cutoffs']->filter(fn (CutOff $c) => $c->deductedHours > 0)
                ->map(fn (CutOff $c) => ['cutoff' => $c, 'user' => $p['user']]))
            ->groupBy(fn (array $x) => $x['cutoff']->start->toDateString())
            ->sortKeys()
            ->map(fn (Collection $rows, string $start) => [
                'start' => $start,
                'end' => $rows->first()['cutoff']->end->toDateString(),
                'deducted_hours' => round($rows->sum(fn ($x) => $x['cutoff']->deductedHours), 2),
                'deducted_pesos' => round($rows->sum(fn ($x) => $this->pesos($x['cutoff']->deductedHoursExact, $x['user'], $policy) ?? 0), 2),
                'people' => $rows->count(),
            ])->values();

        $rows = $people->pluck('row')->sortBy([['days', 'desc'], ['name', 'asc']])->values();

        return [
            'months' => $months,
            'weekdays' => $weekdays,
            'people' => $rows,
            'cutoffs' => $cutoffs,
            'totals' => [
                'deducted_hours' => round($rows->sum('deducted_hours'), 2),
                'deducted_pesos' => round($rows->sum(fn ($r) => $r['deducted_pesos'] ?? 0), 2),
                'missing_rate' => $rows->filter(fn ($r) => ! $r['has_rate'] && $r['deducted_hours'] > 0)->count(),
            ],
            'upcoming' => $this->upcoming($today, $holidays),
        ];
    }

    /** The next 30 days of leave, per person, soonest first. @param list<string> $holidays */
    private function upcoming(CarbonImmutable $today, array $holidays): Collection
    {
        return Leave::query()->with('user:id,name')
            ->whereBetween('date', [$today->toDateString(), $today->addDays(self::UPCOMING_DAYS)->toDateString()])
            ->whereNotIn('date', $holidays)
            ->orderBy('date')
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $ls) => [
                'id' => $ls->first()->user_id,
                'name' => $ls->first()->user->name,
                'dates' => $ls->map(fn (Leave $l) => ['date' => $l->date->toDateString(), 'days' => round((float) $l->days, 2)])->values(),
                'days' => round($ls->sum('days'), 2),
            ])
            ->values();
    }

    /** @param list<string> $holidays @return Collection<int, Leave> */
    private function leavesIn(int $year, array $holidays): Collection
    {
        return Leave::query()
            ->whereBetween('date', ["$year-01-01", "$year-12-31"])
            ->whereNotIn('date', $holidays)
            ->get(['user_id', 'date', 'days']);
    }

    /** @param list<CutOff> $ledger @return Collection<int, CutOff> */
    private function cutOffsIn(array $ledger, int $year): Collection
    {
        return collect($ledger)->filter(fn (CutOff $c) => $c->start->year === $year)->values();
    }

    private function pesos(float $hours, User $user, Policy $policy): ?float
    {
        return PayRate::forHours($user, $hours, $policy);
    }

    /** @return list<int> from the office start year to this year (or the last year with leave) */
    private function years(CarbonImmutable $today): array
    {
        $last = max($today->year, (int) substr((string) Leave::query()->max('date'), 0, 4));

        return range(Policy::officeStartedOn()->year, $last);
    }
}
