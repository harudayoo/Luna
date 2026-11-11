<?php

namespace Tests\Feature\People;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MakeAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_new_admin()
    {
        $this->artisan('luna:make-admin', ['email' => 'me@example.com', '--name' => 'Me'])
            ->expectsQuestion('Password', 'a-good-password')
            ->assertSuccessful();

        $me = User::where('email', 'me@example.com')->firstOrFail();
        $this->assertSame(Role::Admin, $me->role);
        $this->assertSame('Me', $me->name);
        $this->assertNotNull($me->email_verified_at);
        $this->assertTrue(Hash::check('a-good-password', $me->password));
    }

    public function test_it_promotes_an_existing_account_and_can_reset_its_password()
    {
        $me = User::factory()->create(['email' => 'me@example.com']);

        $this->artisan('luna:make-admin', ['email' => 'me@example.com'])
            ->expectsConfirmation('Set a new password?', 'yes')
            ->expectsQuestion('Password', 'a-new-password')
            ->assertSuccessful();

        $me->refresh();
        $this->assertSame(Role::Admin, $me->role);
        $this->assertTrue(Hash::check('a-new-password', $me->password));
    }
}
