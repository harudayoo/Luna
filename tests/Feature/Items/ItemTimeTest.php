<?php

namespace Tests\Feature\Items;

use App\Models\Item;
use App\Models\ItemTime;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Time on an item: a stopwatch (one running per person), a countdown that stops itself at its target, or a
 * typed start-end in office time (Manila). A record only. "Now" is Thu 2026-11-19 10:00 in Manila (02:00 UTC).
 */
class ItemTimeTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create();
    }

    private function item(string $scope = 'personal', string $status = 'queue', ?User $owner = null): Item
    {
        return ($owner ?? $this->ana)->items()->create(['scope' => $scope, 'title' => 'Item', 'status' => $status]);
    }

    public function test_the_stopwatch_runs_one_item_at_a_time_and_starts_its_work()
    {
        $first = $this->item();
        $second = $this->item(status: 'hold');

        $this->actingAs($this->ana)->post(route('items.start', $first))->assertSessionHasNoErrors();
        $this->assertSame('progress', $first->fresh()->status);

        $this->travelTo('2026-11-19 02:25:00');
        $this->actingAs($this->ana)->post(route('items.start', $second))->assertSessionHasNoErrors();
        $this->assertSame('progress', $second->fresh()->status);

        $this->assertSame(25, ItemTime::query()->where('item_id', $first->id)->sole()->minutes());
        $this->assertNull(ItemTime::query()->where('item_id', $second->id)->sole()->ended_at);

        $this->travelTo('2026-11-19 02:40:00');
        $this->actingAs($this->ana)->post(route('items.stop'))->assertSessionHasNoErrors();
        $this->assertSame(15, ItemTime::query()->where('item_id', $second->id)->sole()->minutes());
    }

    public function test_a_countdown_never_counts_past_its_target()
    {
        $item = $this->item();
        $this->actingAs($this->ana)->post(route('items.start', $item), ['target_minutes' => 30])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->post(route('items.start', $item), ['target_minutes' => 0])->assertSessionHasErrors('target_minutes');

        // The tab was closed: the next visit closes it at its target.
        $this->travelTo('2026-11-19 03:30:00');
        $this->actingAs($this->ana)->get(route('items.index'))->assertOk()
            ->assertInertia(fn ($page) => $page->where('running', null));
        $this->assertSame(30, ItemTime::query()->sole()->minutes());
    }

    public function test_a_typed_entry_is_office_time_and_must_end_after_it_starts()
    {
        $item = $this->item();

        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '13:00', 'end' => '15:30'])
            ->assertSessionHasNoErrors();
        $time = ItemTime::query()->sole();
        $this->assertSame(['2026-11-18 05:00:00', '2026-11-18 07:30:00', 150],
            [$time->started_at->utc()->toDateTimeString(), $time->ended_at->utc()->toDateTimeString(), $time->minutes()]);

        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '15:00', 'end' => '14:00'])
            ->assertSessionHasErrors('end');
        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-19', 'start' => '09:00', 'end' => '11:00'])
            ->assertSessionHasErrors('end');
    }

    public function test_company_items_take_anyones_time_and_show_the_totals()
    {
        $ben = User::factory()->create();
        $item = $this->item('company', owner: $ben);

        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '09:00', 'end' => '10:00']);
        $this->actingAs($ben)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '10:00', 'end' => '10:45']);

        $this->actingAs($this->ana)->get(route('items.show', $item))->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('item.total_minutes', 105)
                ->where('item.my_minutes', 60)
                ->has('times', 2));

        $this->actingAs($this->ana)->post(route('items.start', $this->item('personal', owner: $ben)))->assertForbidden();
    }

    public function test_people_remove_only_their_own_entries()
    {
        $ben = User::factory()->create();
        $item = $this->item('company');
        $this->actingAs($ben)->post(route('items.times.store', $item), ['date' => '2026-11-18', 'start' => '09:00', 'end' => '10:00']);
        $time = ItemTime::query()->sole();

        $this->actingAs($this->ana)->delete(route('items.times.destroy', $time))->assertForbidden();
        $this->actingAs($ben)->delete(route('items.times.destroy', $time))->assertRedirect();
        $this->assertDatabaseCount('item_times', 0);
    }
}
