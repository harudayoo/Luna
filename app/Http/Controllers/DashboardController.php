<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Models\WipTile;
use App\Services\Moonlings;
use App\Services\MoonQuests;
use App\Services\Pet;
use App\Services\PetDuels;
use App\Services\Pto\CutOff;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        // A duel notice links to ?pet=duels, an egg notice to ?pet=nest, a quest notice to ?pet=quests, an unlock
        // notice to ?pet=pet. Swap that for a one-time note and the plain address, so the panel opens on that tab
        // once and a refresh of Home doesn't open it again.
        if (in_array($request->query('pet'), ['pet', 'duels', 'nest', 'quests'], true)) {
            return to_route('dashboard')->with('pet_open', $request->query('pet'));
        }

        /** @var User $user */
        $user = $request->user();
        $openTab = $request->session()->get('pet_open');
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
            // The pet panel's extras: only on its partial reload (only: ['pet_detail']), so Home loads no slower.
            'pet_detail' => Inertia::optional(fn () => Pet::detail($user)),
            // The office board, when the panel's board tab opens.
            'pet_board' => Inertia::optional(fn () => Pet::board($user)),
            // Moon duels, when the panel's duels or board tab opens.
            'pet_duels' => Inertia::optional(fn () => PetDuels::tab($user)),
            // The moon nest (slice 6), when the panel's Nest tab opens.
            'pet_nest' => Inertia::optional(fn () => Moonlings::nest($user)),
            // Moon quests (spec 2026-11-26-luna-moonling-style, slice 12), when the panel's Quests tab opens.
            'pet_quests' => Inertia::optional(fn () => MoonQuests::list($user)),
            // This week's quests and the quest streak (slice 18 of the collection spec), with the Quests tab.
            'pet_weekly' => Inertia::optional(fn () => MoonQuests::weekly($user)),
            // Which panel tab to open straight away (once, after a duel or egg notice), or null.
            'pet_open' => in_array($openTab, ['pet', 'duels', 'nest', 'quests'], true) ? $openTab : null,
        ]);
    }
}
