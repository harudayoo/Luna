<?php

namespace Tests\Feature\People;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AcceptInviteTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_invited_person_cannot_log_in_before_accepting()
    {
        $user = User::factory()->invited()->create();

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
    }

    public function test_the_invite_link_opens_the_set_password_page()
    {
        $user = User::factory()->invited()->create();

        $this->get($user->inviteUrl())
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('auth/accept-invite')
                ->where('email', $user->email));
    }

    public function test_an_unsigned_or_expired_link_is_refused()
    {
        $user = User::factory()->invited()->create();
        $url = $user->inviteUrl();

        $this->get(route('invite.show', $user))->assertForbidden();

        $this->travel(8)->days();
        $this->get($url)->assertForbidden();
    }

    public function test_accepting_sets_the_password_verifies_and_signs_in()
    {
        $user = User::factory()->invited()->create();

        $this->post($user->inviteUrl(), [
            'password' => 'a-good-password',
            'password_confirmation' => 'a-good-password',
        ])->assertRedirect(route('dashboard'));

        $user->refresh();
        $this->assertAuthenticatedAs($user);
        $this->assertTrue(Hash::check('a-good-password', $user->password));
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_the_link_only_works_once()
    {
        $user = User::factory()->invited()->create();
        $url = $user->inviteUrl();

        $this->post($url, [
            'password' => 'a-good-password',
            'password_confirmation' => 'a-good-password',
        ]);
        auth()->logout();

        $this->get($url)->assertRedirect(route('login'));
        $this->post($url, [
            'password' => 'someone-else',
            'password_confirmation' => 'someone-else',
        ])->assertRedirect(route('login'));

        $this->assertTrue(Hash::check('a-good-password', $user->fresh()->password));
    }
}
