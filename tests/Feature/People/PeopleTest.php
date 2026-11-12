<?php

namespace Tests\Feature\People;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\InviteNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PeopleTest extends TestCase
{
    use RefreshDatabase;

    public function test_employees_cannot_open_the_people_page()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('people.index'))
            ->assertForbidden();
    }

    public function test_hr_and_admin_see_everyone()
    {
        User::factory()->create();
        $hr = User::factory()->hr()->create();
        $admin = User::factory()->admin()->create();

        foreach ([$hr, $admin] as $viewer) {
            $this->actingAs($viewer)
                ->get(route('people.index'))
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('people/index')
                    ->has('people', 3));
        }
    }

    public function test_only_people_still_invited_have_an_invite_link()
    {
        $hr = User::factory()->hr()->create();
        $invited = User::factory()->invited()->create();

        $this->actingAs($hr)
            ->get(route('people.index'))
            ->assertInertia(fn ($page) => $page
                ->where('people.0.id', $hr->id)
                ->where('people.0.invite_url', null)
                ->where('people.1.id', $invited->id)
                ->whereType('people.1.invite_url', 'string'));
    }

    public function test_hr_can_invite_an_employee()
    {
        Notification::fake();

        $this->actingAs(User::factory()->hr()->create())
            ->post(route('people.store'), [
                'name' => 'Ana Cruz',
                'email' => 'ana@example.com',
                'role' => 'employee',
            ])
            ->assertRedirect(route('people.index'))
            ->assertSessionHasNoErrors();

        $ana = User::where('email', 'ana@example.com')->firstOrFail();
        $this->assertSame(Role::Employee, $ana->role);
        $this->assertNull($ana->password);
        $this->assertNull($ana->email_verified_at);
        Notification::assertSentTo($ana, InviteNotification::class);
    }

    public function test_without_email_set_up_the_invite_says_to_copy_the_link()
    {
        // The office server runs with MAIL_MAILER=log: nothing reaches an inbox, so don't claim it was sent.
        config(['mail.default' => 'log']);
        Notification::fake();
        $hr = User::factory()->hr()->create();

        $this->actingAs($hr)
            ->post(route('people.store'), ['name' => 'Ana Cruz', 'email' => 'ana@example.com', 'role' => 'employee'])
            ->assertRedirect(route('people.index'))
            ->assertInertiaFlash('toast', [
                'type' => 'info',
                'message' => 'Ana Cruz was added. Copy their invite link and send it to them.',
            ]);

        $ana = User::where('email', 'ana@example.com')->firstOrFail();
        Notification::assertNothingSent();

        $this->actingAs($hr)
            ->post(route('people.invite', $ana))
            ->assertInertiaFlash('toast', [
                'type' => 'info',
                'message' => 'No email is set up. Copy Ana Cruz\'s invite link and send it to them.',
            ]);
        Notification::assertNothingSent();
    }

    public function test_hr_cannot_invite_hr_or_admin()
    {
        $hr = User::factory()->hr()->create();

        foreach (['hr', 'admin'] as $role) {
            $this->actingAs($hr)
                ->post(route('people.store'), [
                    'name' => 'Someone',
                    'email' => "$role@example.com",
                    'role' => $role,
                ])
                ->assertSessionHasErrors('role');

            $this->assertDatabaseMissing('users', ['email' => "$role@example.com"]);
        }
    }

    public function test_admin_can_invite_hr()
    {
        Notification::fake();

        $this->actingAs(User::factory()->admin()->create())
            ->post(route('people.store'), [
                'name' => 'Backup HR',
                'email' => 'backup@example.com',
                'role' => 'hr',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Role::Hr, User::where('email', 'backup@example.com')->first()->role);
    }

    public function test_invited_email_must_be_new()
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs(User::factory()->hr()->create())
            ->post(route('people.store'), [
                'name' => 'Dup',
                'email' => 'taken@example.com',
                'role' => 'employee',
            ])
            ->assertSessionHasErrors('email');
    }

    public function test_employees_cannot_invite()
    {
        $this->actingAs(User::factory()->create())
            ->post(route('people.store'), [
                'name' => 'X',
                'email' => 'x@example.com',
                'role' => 'employee',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_change_a_role()
    {
        $employee = User::factory()->create();

        $this->actingAs(User::factory()->admin()->create())
            ->patch(route('people.role', $employee), ['role' => 'hr'])
            ->assertSessionHasNoErrors();

        $this->assertSame(Role::Hr, $employee->fresh()->role);
    }

    public function test_hr_cannot_change_roles()
    {
        $employee = User::factory()->create();

        $this->actingAs(User::factory()->hr()->create())
            ->patch(route('people.role', $employee), ['role' => 'hr'])
            ->assertForbidden();

        $this->assertSame(Role::Employee, $employee->fresh()->role);
    }

    public function test_the_last_admin_cannot_step_down()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->patch(route('people.role', $admin), ['role' => 'employee'])
            ->assertSessionHasErrors('role');

        $this->assertSame(Role::Admin, $admin->fresh()->role);
    }

    public function test_an_admin_can_step_down_when_another_admin_exists()
    {
        $admin = User::factory()->admin()->create();
        User::factory()->admin()->create();

        $this->actingAs($admin)
            ->patch(route('people.role', $admin), ['role' => 'employee'])
            ->assertSessionHasNoErrors();

        $this->assertSame(Role::Employee, $admin->fresh()->role);
    }
}
