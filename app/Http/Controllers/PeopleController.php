<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\InviteNotification;
use App\Services\Payroll\PayslipMath;
use App\Services\Pto\Policy;
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
            'deactivated' => $user->isDeactivated(),
            'invite_url' => $user->isPendingInvite() ? $user->inviteUrl() : null,
            'position' => $user->position,
            'monthly_salary' => $user->monthly_salary === null ? null : (float) $user->monthly_salary,
            'daily_rate' => $user->daily_rate === null ? null : (float) $user->daily_rate,
            'pto_start' => $user->pto_start?->toDateString(),
            'pto_opening_hours' => (float) $user->pto_opening_hours,
        ]);

        return Inertia::render('people/index', [
            'people' => $people,
            'officeStartedOn' => Policy::officeStartedOn()->toDateString(),
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

    /** HR sets a person's PTO values: daily rate (for deductions), start date, opening balance. */
    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'position' => ['nullable', 'string', 'max:80'],
            // Pay is monthly; the daily rate used for PTO deductions is derived from it (x 12 / 260).
            'monthly_salary' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'daily_rate' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'pto_start' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.Policy::officeStartedOn()->toDateString()],
            'pto_opening_hours' => ['required', 'numeric', 'min:0', 'max:1000'],
        ], [
            'pto_start.after_or_equal' => 'Start dates can\'t be before the office opened ('.Policy::officeStartedOn()->format('M j, Y').').',
        ]);

        if ($request->filled('monthly_salary')) {
            $validated['daily_rate'] = PayslipMath::dailyRate((float) $validated['monthly_salary'], Policy::current()->workDaysPerYear);
        }
        $user->update($validated);
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name}'s leave details saved."]);

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

    /** Admin ends someone's access. Their leave and payroll history stay, and they can be reactivated. */
    public function deactivate(Request $request, User $user): RedirectResponse
    {
        $message = match (true) {
            $user->is($request->user()) => "You can't deactivate your own account.",
            $user->role === Role::Admin && User::where('role', Role::Admin)->whereNull('deactivated_at')->count() === 1 => 'Luna needs at least one active admin. Make someone else admin first.',
            default => null,
        };
        if ($message !== null) {
            throw ValidationException::withMessages(['account' => $message]);
        }

        $user->forceFill(['deactivated_at' => now()])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name} is deactivated and can't sign in. Their history stays."]);

        return to_route('people.index');
    }

    public function reactivate(User $user): RedirectResponse
    {
        $user->forceFill(['deactivated_at' => null])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name} can sign in again."]);

        return to_route('people.index');
    }

    /** Emails a pending invite again (a fresh 7-day link). */
    public function resendInvite(Request $request, User $user): RedirectResponse
    {
        if (! $user->isPendingInvite()) {
            throw ValidationException::withMessages(['invite' => "{$user->name} already accepted their invite."]);
        }

        try {
            $user->notify(new InviteNotification($request->user()));
            Inertia::flash('toast', ['type' => 'success', 'message' => "Invite sent to {$user->email} again."]);
        } catch (Throwable $e) {
            report($e);
            Inertia::flash('toast', ['type' => 'warning', 'message' => "The email didn't send. Copy {$user->name}'s invite link instead."]);
        }

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
