<?php

namespace Tests\Feature\Items;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Client companies and their WIP item channels: seeded from the user's list, kept up by admin. */
class CompanyTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_known_companies_and_channels_are_there()
    {
        $this->assertSame(['HDI', 'INS', 'NPIA', 'PAIC', 'QSS', 'RLI', 'SSI', 'STM'], Company::query()->orderBy('tag')->pluck('tag')->all());
        $ssi = Company::query()->where('tag', 'SSI')->sole();
        $this->assertSame(['Equine Items', 'Farm Items'], $ssi->channels()->orderBy('name')->pluck('name')->all());
        $this->assertStringStartsWith('https://wip.quicksilversystems.com/servers/', $ssi->channels()->first()->url);
        $this->assertDatabaseCount('company_channels', 11);
    }

    public function test_only_admin_manages_companies_and_channels()
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs(User::factory()->hr()->create())->get(route('people.companies'))->assertForbidden();
        $this->actingAs(User::factory()->create())->post(route('people.companies.store'), ['tag' => 'ACM', 'name' => 'Acme'])->assertForbidden();

        $this->actingAs($admin)->get(route('people.companies'))->assertOk()
            ->assertInertia(fn ($page) => $page->component('people/companies')->has('companies', 8));

        $this->actingAs($admin)->post(route('people.companies.store'), ['tag' => 'acm', 'name' => 'Acme Corp'])->assertSessionHasNoErrors();
        $acme = Company::query()->where('tag', 'ACM')->sole();
        $this->actingAs($admin)->post(route('people.companies.store'), ['tag' => 'QSS', 'name' => 'Again'])->assertSessionHasErrors('tag');
        $this->actingAs($admin)->post(route('people.companies.store'), ['tag' => 'TOOLONG', 'name' => 'X'])->assertSessionHasErrors('tag');

        $this->actingAs($admin)->put(route('people.companies.update', $acme), ['tag' => 'ACME', 'name' => 'Acme Inc'])->assertSessionHasNoErrors();
        $this->assertSame(['ACME', 'Acme Inc'], [$acme->fresh()->tag, $acme->fresh()->name]);

        $this->actingAs($admin)->post(route('people.companies.channels.store', $acme), ['name' => 'Items', 'url' => 'https://example.com/board'])
            ->assertSessionHasErrors('url');
        $this->actingAs($admin)->post(route('people.companies.channels.store', $acme), ['name' => 'Items', 'url' => 'https://wip.quicksilversystems.com/servers/x/channels/y?selectedView=board'])
            ->assertSessionHasNoErrors();
        $channel = $acme->channels()->sole();

        $this->actingAs($admin)->put(route('people.channels.update', $channel), ['name' => 'Tickets', 'url' => $channel->url])->assertSessionHasNoErrors();
        $this->assertSame('Tickets', $channel->fresh()->name);

        $item = $admin->items()->create(['scope' => 'company', 'title' => 'X', 'status' => 'queue', 'channel_id' => $channel->id]);
        $this->actingAs($admin)->delete(route('people.companies.destroy', $acme))->assertRedirect();
        $this->assertNull($item->fresh()->channel_id);
        $this->assertDatabaseMissing('companies', ['tag' => 'ACME']);
    }

    public function test_home_offers_the_company_tags_for_wip_tiles()
    {
        $this->actingAs(User::factory()->create())->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('wip_tags', ['OCS', 'HDI', 'INS', 'NPIA', 'PAIC', 'QSS', 'RLI', 'SSI', 'STM']));
    }
}
