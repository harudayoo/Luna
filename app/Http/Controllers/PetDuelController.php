<?php

namespace App\Http\Controllers;

use App\Models\PetDuel;
use App\Models\User;
use App\Services\PetDuels;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Moon duels (App\Services\PetDuels): send one, answer one sent to you, or pass on it. */
class PetDuelController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'opponent_id' => ['required', 'integer', 'exists:users,id'],
            'pick' => ['required', Rule::in(PetDuels::PICKS)],
        ]);

        PetDuels::challenge($request->user(), User::query()->findOrFail($data['opponent_id']), $data['pick']);

        return back();
    }

    public function answer(Request $request, PetDuel $duel): RedirectResponse
    {
        abort_unless($duel->opponent_id === $request->user()->id, 403);
        $data = $request->validate(['pick' => ['required', Rule::in(PetDuels::PICKS)]]);

        PetDuels::answer($duel, $request->user(), $data['pick']);

        return back();
    }

    public function decline(Request $request, PetDuel $duel): RedirectResponse
    {
        abort_unless($duel->opponent_id === $request->user()->id, 403);

        PetDuels::decline($duel, $request->user());

        return back();
    }
}
