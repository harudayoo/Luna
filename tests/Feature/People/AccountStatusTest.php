<?php

namespace Tests\Feature\People;

use App\Models\Leave;
use App\Models\User;
use App\Notifications\InviteNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Ending access without losing history: admins deactivate and reactivate accounts; nobody deletes
 * their own. HR can resend a pending invite. "Today" is Wed 2026-11-11.
 */
class AccountStatusTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->admin = User::factory()->admin()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'email' => 'ana@example.com']);
    }

    public function test_admin_deactivates_and_reactivates_an_account()
    {
        $this->actingAs($this->admin)
            ->patch(route('people.deactivate', $this->ana))
            ->assertRedirect(route('people.index'));
        $this->assertNotNull($this->ana->fresh()->deactivated_at);

        $this->actingAs($this->admin)
            ->get(route('people.index'))
            ->assertInertia(fn ($page) => $page->where('people.1.deactivated', true));

        $this->actingAs($this->admin)
            ->patch(route('people.reactivate', $this->ana))
            ->assertRedirect(route('people.index'));
        $this->assertNull($this->ana->fresh()->deactivated_at);
    }

    public function test_only_admin_deactivates()
    {
        $this->actingAs(User::factory()->hr()->create())
            ->patch(route('people.deactivate', $this->ana))
            ->assertForbidden();

        $this->assertNull($this->ana->fresh()->deactivated_at);
    }

    public function test_you_cannot_deactivate_yourself_or_the_last_admin()
    {
        $this->actingAs($this->admin)
            ->patch(route('people.deactivate', $this->admin))
            ->assertSessionHasErrors('account');

        $other = User::factory()->admin()->create();
        $other->forceFill(['deactivated_at' => now()])->save();
        $third = User::factory()->admin()->create();
        $this->actingAs($third)
            ->patch(route('people.deactivate', $this->admin))
            ->assertSessionHasNoErrors();
        // Now $third is the only active admin; nobody else can turn it off (and it can't itself).
        $this->actingAs($third)
            ->patch(route('people.deactivate', $third))
            ->assertSessionHasErrors('account');
    }

    public function test_a_deactivated_account_cannot_sign_in()
    {
        $this->ana->forceFill(['deactivated_at' => now()])->save();

        $this->post(route('login.store'), ['email' => 'ana@example.com', 'password' => 'password'])
            ->assertSessionHasErrors(['email' => 'This account is deactivated. Ask an admin to reactivate it.']);
        $this->assertGuest();
    }

    public function test_an_open_session_ends_once_deactivated()
    {
        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk();

        $this->ana->forceFill(['deactivated_at' => now()])->save();

        $this->actingAs($this->ana)
            ->get(route('dashboard'))
            ->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_leave_and_pay_hides_deactivated_people_without_leave_in_the_cut_off()
    {
        $ben = User::factory()->create(['name' => 'Ben Gone']);
        $ben->forceFill(['deactivated_at' => now()])->save();
        $this->ana->forceFill(['deactivated_at' => now()])->save();
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-03']);

        $this->actingAs($this->admin)
            ->get(route('people.leave'))
            ->assertInertia(fn ($page) => $page
                ->has('rows', 2)
                ->where('rows.1.name', 'Ana Cruz')
                ->where('rows.1.deactivated', true));
    }

    public function test_hr_resends_a_pending_invite_only()
    {
        Notification::fake();
        $hr = User::factory()->hr()->create();
        $invited = User::factory()->invited()->create();

        $this->actingAs($hr)
            ->post(route('people.invite', $invited))
            ->assertRedirect(route('people.index'));
        Notification::assertSentTo($invited, InviteNotification::class);

        $this->actingAs($hr)
            ->post(route('people.invite', $this->ana))
            ->assertSessionHasErrors('invite');
        Notification::assertNotSentTo($this->ana, InviteNotification::class);
    }

    public function test_nobody_deletes_their_own_account()
    {
        $this->actingAs($this->ana)
            ->delete('/settings/profile', ['password' => 'password'])
            ->assertStatus(405);

        $this->assertModelExists($this->ana);
    }
}
