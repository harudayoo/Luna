<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Services\Pto\CutOff;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $policy = Policy::current();
        $today = CarbonImmutable::today();
        $current = collect($user->ptoLedger($policy, $today))->first(fn (CutOff $c) => $c->contains($today));

        return Inertia::render('dashboard', [
            'pto' => [
                'balance_hours' => $current?->startBalance ?? 0,
                'hours_per_day' => $policy->hoursPerDay,
                'next_payday' => $current?->end->toDateString(),
                'next_accrual' => $current?->accrued,
            ],
            // People out today (none on a holiday: the office is closed).
            'out_today' => Holiday::query()->where('date', $today->toDateString())->exists()
                ? 0
                : Leave::query()->where('date', $today->toDateString())->distinct()->count('user_id'),
            // Time (the headline card) and the WIP channels: WIP is the office's main channel.
            'today' => TimeController::today($user),
            'wip' => config('luna.wip'),
        ]);
    }
}
