<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Models\WipTile;
use App\Services\Pet;
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
        $fed = Pet::visit($user);
        $grew = $request->session()->pull(Pet::GREW, false);

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
            // The channels, then the links, this person pinned under the office's tiles.
            'my_wip' => $user->wipTiles()->where('kind', 'wip')->get()->map(fn (WipTile $t) => $t->toTile()),
            'my_links' => $user->wipTiles()->where('kind', 'link')->get()->map(fn (WipTile $t) => $t->toTile()),
            'wip_max' => WipTile::MAX,
            // Tags for pinned tiles: the office's own, then every client company's.
            'wip_tags' => ['OCS', ...Company::query()->orderBy('tag')->pluck('tag')->all()],
            // The person's pet, and what just happened to it on this load (for the card's motion).
            'pet' => Pet::state($user),
            'pet_moment' => $grew ? 'grew' : ($fed ? 'fed' : null),
        ]);
    }
}
