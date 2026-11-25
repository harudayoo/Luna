<?php

namespace Tests\Feature\Pet;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * A duel notice links to /dashboard?pet=duels: Home swaps it for the plain address and opens the pet panel on the
 * Duels tab once (spec 2026-11-25-luna-pet-social, slice 3). Written after the code, as extra coverage.
 */
class PetDuelLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_duel_link_opens_the_duels_tab_once_on_the_plain_address()
    {
        $ana = User::factory()->create();

        $this->actingAs($ana)->get(route('dashboard', ['pet' => 'duels']))->assertRedirect(route('dashboard'));

        $this->actingAs($ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', 'duels'));

        $this->actingAs($ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', null));
    }
}
