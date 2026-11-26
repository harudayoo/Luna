<?php

namespace App\Http\Controllers;

use App\Models\Moonling;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Your own pet's settings (spec 2026-11-25-luna-pet-social): its name (empty clears it) and whether it's on the
 * office board. Each is changed only when it's sent.
 */
class PetController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:20'],
            'public' => ['sometimes', 'boolean'],
        ]);

        // The name belongs to the moonling you're raising (slice 6).
        if (array_key_exists('name', $data)) {
            Moonlings::active($user)->update(['name' => $data['name']]);
            Moonlings::checkUnlocks($user); // naming unlocks the bow (slice 7)
        }
        if (array_key_exists('public', $data)) {
            $user->pet_public = (bool) $data['public'];
            $user->save();
        }

        return back();
    }

    /** The wardrobe (slice 7): a shade and/or items on one of your own moonlings. */
    public function dress(Request $request, Moonling $moonling): RedirectResponse
    {
        $data = $request->validate([
            'palette' => ['sometimes', 'string'],
            'wear' => ['sometimes', 'array'],
            'wear.*' => ['string'],
        ]);
        Moonlings::dress($request->user(), $moonling, $data);

        return back();
    }

    /** Raise another moonling from your nest (spec 2026-11-25-luna-moonling-life, slice 6). */
    public function active(Request $request): RedirectResponse
    {
        $data = $request->validate(['moonling_id' => ['required', 'integer']]);
        Moonlings::switchTo($request->user(), (int) $data['moonling_id']);

        return back();
    }

    /** The first tap on your pet each office day (spec 2026-11-25-luna-moonling-life, slice 5): mood only, no XP. */
    public function pat(Request $request): RedirectResponse
    {
        Pet::pat($request->user());

        return back();
    }
}
