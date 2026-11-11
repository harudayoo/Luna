<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The page shell uses the Orchid City design system's theme switch
 * (<html data-theme>, saved as "ocs-theme"), not the starter kit's
 * "appearance" cookie and .dark class.
 */
class OcsThemeTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_view_sets_the_ocs_theme_before_paint()
    {
        $html = $this->get(route('login'))->assertOk()->getContent();

        $this->assertStringContainsString('data-theme=', $html);
        $this->assertStringContainsString("localStorage.getItem('ocs-theme')", $html);
        $this->assertStringNotContainsString('appearance', $html);
    }

    public function test_appearance_settings_page_is_gone()
    {
        $this->actingAs(User::factory()->create())
            ->get('/settings/appearance')
            ->assertNotFound();
    }
}
