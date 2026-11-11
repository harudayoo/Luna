<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Signs out an account an admin has deactivated, on its next request. Sign-in itself is refused in
 * FortifyServiceProvider; this covers sessions that were already open and passkey sign-ins.
 */
class EnsureAccountIsActive
{
    public const MESSAGE = 'This account is deactivated. Ask an admin to reactivate it.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->isDeactivated()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors(['email' => self::MESSAGE]);
        }

        return $next($request);
    }
}
