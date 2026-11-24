<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Luna's bell: open one notice (marks it read, goes to its page), or mark them all read. */
class NotificationController extends Controller
{
    public function open(Request $request, string $id): RedirectResponse
    {
        $notice = $request->user()->notifications()->findOrFail($id);
        $notice->markAsRead();

        return redirect($notice->data['url'] ?? route('dashboard'));
    }

    public function readAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back();
    }
}
