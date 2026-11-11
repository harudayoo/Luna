<?php

namespace App\Http\Controllers\Auth;

use App\Concerns\PasswordValidationRules;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The invite link (signed, 7 days): the invited person sets their password, which also
 * proves they own the email. Once a password exists the link is spent.
 */
class AcceptInviteController extends Controller
{
    use PasswordValidationRules;

    public function show(User $user): Response|RedirectResponse
    {
        if (! $user->isPendingInvite()) {
            return $this->alreadyAccepted();
        }

        return Inertia::render('auth/accept-invite', [
            'name' => $user->name,
            'email' => $user->email,
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse
    {
        if (! $user->isPendingInvite()) {
            return $this->alreadyAccepted();
        }

        $validated = $request->validate(['password' => $this->passwordRules()]);

        $user->password = $validated['password'];
        $user->email_verified_at = now();
        $user->save();

        Auth::login($user);
        $request->session()->regenerate();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Welcome to Luna.']);

        return to_route('dashboard');
    }

    private function alreadyAccepted(): RedirectResponse
    {
        return to_route('login')->with('status', 'This invite was already used. Log in with your password.');
    }
}
