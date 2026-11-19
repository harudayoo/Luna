<?php

namespace Tests\Feature\Items;

use App\Models\CompanyChannel;
use App\Models\Item;
use App\Models\ItemTime;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Items on a client's WIP channel: time reads as WIP takes it (2h 35m), and logging it hands over to that
 * channel's board. "Now" is Thu 2026-11-19 10:00 in Manila (02:00 UTC).
 */
class ItemChannelTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private CompanyChannel $equine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create();
        $this->equine = CompanyChannel::query()->where('name', 'Equine Items')->sole();
    }

    public function test_wip_time_reads_hours_and_minutes()
    {
        $this->assertSame(['2h 35m', '45m', '2h', '0m'], array_map(ItemTime::wip(...), [155, 45, 120, 0]));
    }

    public function test_an_item_takes_a_channel_and_a_new_one_always_shows()
    {
        $this->actingAs($this->ana)
            ->post(route('items.store'), ['scope' => 'company', 'title' => 'Horse policy', 'channel_id' => $this->equine->id])
            ->assertRedirect(route('items.index'));
        $this->assertSame($this->equine->id, Item::query()->sole()->channel_id);

        $this->actingAs($this->ana)->post(route('items.store'), ['scope' => 'personal', 'title' => 'X', 'channel_id' => 99999])
            ->assertSessionHasErrors('channel_id');

        $this->actingAs($this->ana)->get(route('items.index'))
            ->assertInertia(fn ($page) => $page
                ->where('items.0.channel.label', 'SSI · Equine Items')
                ->where('items.0.channel.url', $this->equine->url)
                ->has('channels', 11));
    }

    public function test_logging_time_hands_over_to_the_channel_board()
    {
        $item = $this->ana->items()->create(['scope' => 'company', 'code' => '7937', 'title' => 'Horse policy', 'status' => 'queue', 'channel_id' => $this->equine->id]);

        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '13:00', 'end' => '15:35'])
            ->assertSessionHas('inertia.flash_data.item_logged', fn ($l) => $l['wip'] === '2h 35m' && $l['code'] === '7937'
                && $l['channel']['url'] === $this->equine->url && $l['channel']['label'] === 'SSI · Equine Items');

        $this->actingAs($this->ana)->post(route('items.start', $item));
        $this->travelTo('2026-11-19 02:45:00');
        $this->actingAs($this->ana)->post(route('items.stop'))
            ->assertSessionHas('inertia.flash_data.item_logged', fn ($l) => $l['wip'] === '45m');

        $personal = $this->ana->items()->create(['scope' => 'personal', 'title' => 'Mine', 'status' => 'queue']);
        $this->actingAs($this->ana)->post(route('items.times.store', $personal), ['date' => '2026-11-18', 'start' => '09:00', 'end' => '10:00'])
            ->assertSessionHas('inertia.flash_data.item_logged', fn ($l) => $l['wip'] === '1h' && $l['channel'] === null);
    }
}
