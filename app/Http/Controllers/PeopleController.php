<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\InviteNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * People: everyone with a Luna account. HR and admin invite; only admin changes roles.
 */
class PeopleController extends Controller
{
    public function index(Request $request): Response
    {
        $people = User::query()->orderBy('id')->get()->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'invited' => $user->isPendingInvite(),
            'invite_url' => $user->isPendingInvite() ? $user->inviteUrl() : null,
        ]);

        return Inertia::render('people/index', [
            'people' => $people,
            'roles' => collect(Role::cases())->map(fn (Role $role) => [
                'value' => $role->value,
                'label' => $role->label(),
            ]),
            'invitableRoles' => $this->invitableRoles($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)],
            'role' => ['required', Rule::in($this->invitableRoles($request->user()))],
        ]);

        $user = new User(['name' => $validated['name'], 'email' => $validated['email']]);
        $user->role = Role::from($validated['role']);
        $user->save();

        try {
            $user->notify(new InviteNotification($request->user()));
            Inertia::flash('toast', ['type' => 'success', 'message' => "Invite sent to {$user->email}."]);
        } catch (Throwable $e) {
            report($e);
            Inertia::flash('toast', ['type' => 'warning', 'message' => "{$user->name} was added, but the email didn't send. Copy their invite link instead."]);
        }

        return to_route('people.index');
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $role = Role::from($request->validate([
            'role' => ['required', Rule::enum(Role::class)],
        ])['role']);

        if ($user->role === Role::Admin && $role !== Role::Admin
            && User::where('role', Role::Admin)->count() === 1) {
            throw ValidationException::withMessages([
                'role' => 'Luna needs at least one admin. Make someone else admin first.',
            ]);
        }

        $user->role = $role;
        $user->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name} is now {$role->label()}."]);

        return to_route('people.index');
    }

    /**
     * HR invites employees; admin can invite any role.
     *
     * @return list<string>
     */
    private function invitableRoles(User $inviter): array
    {
        return $inviter->can('admin')
            ? array_map(fn (Role $role) => $role->value, Role::cases())
            : [Role::Employee->value];
    }
}
