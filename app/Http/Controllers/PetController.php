<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Your own pet's settings (spec 2026-11-25-luna-pet-social): its name. Empty clears it. */
class PetController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate(['name' => ['nullable', 'string', 'max:20']]);

        $user->forceFill(['pet_name' => $data['name'] ?? null])->save();

        return back();
    }
}
