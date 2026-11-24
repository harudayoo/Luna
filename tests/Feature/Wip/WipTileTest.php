<?php

namespace Tests\Feature\Wip;

use App\Models\User;
use App\Models\WipTile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Everyone can pin up to four of their own WIP channels on Home, under the office's OCS/QSS tiles: a tag
 * (OCS, QSS or a custom one of up to 4 characters), a name, a short description and the WIP link it opens.
 */
class WipTileTest extends TestCase
{
    use RefreshDatabase;

    private const LINK = 'https://wip.quicksilversystems.com/servers/1d2a17e2/channels/a0b29c6f';

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
    }

    private function pin(array $input = [], ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->ana)->post(route('wip-tiles.store'), $input + [
            'tag' => 'OCS', 'name' => 'design', 'about' => 'Mockups and reviews.', 'url' => self::LINK,
        ]);
    }

    public function test_a_pinned_tile_shows_on_its_owners_home_only()
    {
        $this->pin()->assertSessionHasNoErrors();
        $this->pin(['tag' => 'qss', 'name' => 'client-acme', 'about' => ''])->assertSessionHasNoErrors();
        $this->pin(['tag' => 'pm1', 'name' => 'standup'])->assertSessionHasNoErrors();

        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('wip_max', 4)
                ->has('my_wip', 3)
                ->where('my_wip.0.tag', 'OCS')
                ->where('my_wip.0.name', 'design')
                ->where('my_wip.0.about', 'Mockups and reviews.')
                ->where('my_wip.0.url', self::LINK)
                ->where('my_wip.1.tag', 'QSS')
                ->where('my_wip.1.about', null)
                ->where('my_wip.2.tag', 'PM1'));

        $this->actingAs(User::factory()->create())->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->has('my_wip', 0));
    }

    public function test_four_tiles_at_most()
    {
        foreach (range(1, 4) as $i) {
            $this->pin(['name' => "channel-$i"])->assertSessionHasNoErrors();
        }

        $this->pin(['name' => 'channel-5'])->assertSessionHasErrors('tiles');
        $this->assertSame(4, $this->ana->wipTiles()->count());
    }

    public function test_only_wip_links_are_accepted()
    {
        foreach ([
            'https://example.com/channels/1',
            'http://wip.quicksilversystems.com/servers/1',
            'https://wip.quicksilversystems.com.evil.example/x',
            'javascript:alert(1)',
            'wip.quicksilversystems.com/servers/1',
        ] as $url) {
            $this->pin(['url' => $url])->assertSessionHasErrors('url');
        }

        $this->assertSame(0, WipTile::query()->count());
    }

    public function test_tag_name_and_description_are_checked()
    {
        $this->pin(['tag' => 'TEAMS'])->assertSessionHasErrors('tag');
        $this->pin(['tag' => 'A-B'])->assertSessionHasErrors('tag');
        $this->pin(['tag' => ''])->assertSessionHasErrors('tag');
        $this->pin(['name' => ''])->assertSessionHasErrors('name');
        $this->pin(['name' => str_repeat('x', 41)])->assertSessionHasErrors('name');
        $this->pin(['about' => str_repeat('x', 81)])->assertSessionHasErrors('about');

        $this->assertSame(0, WipTile::query()->count());
    }

    public function test_owner_edits_and_removes_others_cannot()
    {
        $this->pin()->assertSessionHasNoErrors();
        $tile = $this->ana->wipTiles()->first();
        $ben = User::factory()->hr()->create();

        $this->actingAs($ben)->put(route('wip-tiles.update', $tile), ['tag' => 'QSS', 'name' => 'x', 'url' => self::LINK])->assertForbidden();
        $this->actingAs($ben)->delete(route('wip-tiles.destroy', $tile))->assertForbidden();

        $this->actingAs($this->ana)->put(route('wip-tiles.update', $tile), [
            'tag' => 'dev', 'name' => 'frontend', 'about' => '', 'url' => self::LINK.'/content-node/9',
        ])->assertSessionHasNoErrors();
        $tile->refresh();
        $this->assertSame(['DEV', 'frontend', null, self::LINK.'/content-node/9'], [$tile->tag, $tile->name, $tile->about, $tile->url]);

        // Editing at the cap is fine: it isn't a new tile.
        foreach (range(2, 4) as $i) {
            $this->pin(['name' => "channel-$i"]);
        }
        $this->actingAs($this->ana)->put(route('wip-tiles.update', $tile), ['tag' => 'OCS', 'name' => 'frontend', 'url' => self::LINK])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->ana)->delete(route('wip-tiles.destroy', $tile))->assertSessionHasNoErrors();
        $this->assertModelMissing($tile);
    }

    public function test_the_migration_rolls_back()
    {
        Artisan::call('migrate:rollback', ['--path' => ['database/migrations/2026_11_13_000018_create_wip_tiles_table.php']]);
        $this->assertFalse(Schema::hasTable('wip_tiles'));

        Artisan::call('migrate');
        $this->assertTrue(Schema::hasTable('wip_tiles'));
    }

    public function test_a_pinned_link_can_be_any_web_address_and_has_its_own_row()
    {
        $this->pin()->assertSessionHasNoErrors();
        $this->pin(['kind' => 'link', 'name' => 'Jira board', 'about' => '', 'url' => 'https://acme.atlassian.net/jira/boards/1'])
            ->assertSessionHasNoErrors();
        $this->pin(['kind' => 'link', 'tag' => 'ssi', 'name' => 'Staging', 'url' => 'http://10.0.0.5:8080/login'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('my_wip', 1)
                ->where('my_wip.0.kind', 'wip')
                ->has('my_links', 2)
                ->where('my_links.0.kind', 'link')
                ->where('my_links.0.name', 'Jira board')
                ->where('my_links.0.about', null)
                ->where('my_links.0.url', 'https://acme.atlassian.net/jira/boards/1')
                ->where('my_links.1.tag', 'SSI'));

        $this->actingAs(User::factory()->create())->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->has('my_links', 0));
    }

    public function test_four_links_at_most_apart_from_the_four_channels()
    {
        foreach (range(1, 4) as $i) {
            $this->pin(['name' => "channel-$i"])->assertSessionHasNoErrors();
            $this->pin(['kind' => 'link', 'name' => "link-$i", 'url' => "https://example.com/$i"])->assertSessionHasNoErrors();
        }

        $this->pin(['kind' => 'link', 'name' => 'link-5', 'url' => 'https://example.com/5'])->assertSessionHasErrors('tiles');
        $this->assertSame(8, $this->ana->wipTiles()->count());
    }

    public function test_links_must_be_web_addresses_and_kind_is_checked()
    {
        foreach (['javascript:alert(1)', 'ftp://example.com/x', 'example.com', 'data:text/html,hi'] as $url) {
            $this->pin(['kind' => 'link', 'url' => $url])->assertSessionHasErrors('url');
        }
        $this->pin(['kind' => 'other'])->assertSessionHasErrors('kind');

        $this->assertSame(0, WipTile::query()->count());
    }

    public function test_an_edited_link_stays_a_link()
    {
        $this->pin(['kind' => 'link', 'url' => 'https://example.com/a'])->assertSessionHasNoErrors();
        $tile = $this->ana->wipTiles()->first();

        $this->actingAs($this->ana)->put(route('wip-tiles.update', $tile), [
            'kind' => 'wip', 'tag' => 'OCS', 'name' => 'docs', 'url' => 'https://example.com/b',
        ])->assertSessionHasNoErrors();
        $tile->refresh();
        $this->assertSame(['link', 'docs', 'https://example.com/b'], [$tile->kind, $tile->name, $tile->url]);
    }

    public function test_the_link_kind_migration_rolls_back()
    {
        Artisan::call('migrate:rollback', ['--path' => ['database/migrations/2026_11_24_000025_add_kind_to_wip_tiles_table.php']]);
        $this->assertFalse(Schema::hasColumn('wip_tiles', 'kind'));

        Artisan::call('migrate');
        $this->assertTrue(Schema::hasColumn('wip_tiles', 'kind'));
    }
}
