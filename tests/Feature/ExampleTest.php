<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_sends_guests_to_the_login_page()
    {
        $this->get(route('home'))->assertRedirect(route('dashboard'));
        $this->get(route('dashboard'))->assertRedirect(route('login'));
    }

    public function test_home_sends_signed_in_users_to_the_dashboard()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('home'))
            ->assertRedirect(route('dashboard'));
    }
}
