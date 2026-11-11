<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Luna has no self-registration: HR creates every account by invite.
 */
class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_does_not_exist()
    {
        $this->get('/register')->assertNotFound();
    }

    public function test_nobody_can_register_themselves()
    {
        $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertNotFound();

        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_login_page_has_no_sign_up_link()
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->missing('canRegister'));
    }
}
