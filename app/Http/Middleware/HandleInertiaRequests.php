<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Notify;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                // What the UI may show; the routes still enforce the same gates.
                'can' => [
                    'hr' => (bool) $request->user()?->can('hr'),
                    'admin' => (bool) $request->user()?->can('admin'),
                ],
            ],
            // The bell and the dock dots. A closure, so the bell's poll can reload just this.
            'notifications' => fn () => $request->user() ? $this->notifications($request->user()) : null,
        ];
    }

    /** @return array{unread: int, items: list<array<string, mixed>>, modules: array<string, int>} */
    private function notifications(User $user): array
    {
        Notify::payslipsDue($user);
        $unread = $user->unreadNotifications()->get(['data']);

        return [
            'unread' => $unread->count(),
            'items' => $user->notifications()->latest()->limit(15)->get()->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'kind' => $n->data['kind'] ?? '',
                'title' => $n->data['title'] ?? '',
                'body' => $n->data['body'] ?? '',
                'module' => $n->data['module'] ?? null,
                'read' => $n->read_at !== null,
                'ago' => $n->created_at->diffForHumans(short: true),
            ])->all(),
            'modules' => $unread->countBy(fn (DatabaseNotification $n) => $n->data['module'] ?? '')->forget('')->all(),
        ];
    }
}
