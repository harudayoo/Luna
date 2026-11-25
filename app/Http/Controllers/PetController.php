<?php

namespace App\Http\Controllers;

use App\Models\User;
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

        if (array_key_exists('name', $data)) {
            $user->pet_name = $data['name'];
        }
        if (array_key_exists('public', $data)) {
            $user->pet_public = (bool) $data['public'];
        }
        $user->save();

        return back();
    }
}
