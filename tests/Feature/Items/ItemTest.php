<?php

namespace Tests\Feature\Items;

use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The item vault: work items people log. Personal items are their creator's alone; Company items are shared
 * with everyone, who can all move them through On Queue, In Progress, On Hold and Done.
 */
class ItemTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $ben;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 01:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->ben = User::factory()->create(['name' => 'Ben Santos']);
    }

    private function item(User $owner, string $scope, string $title = 'Fix login', string $status = 'queue'): Item
    {
        return $owner->items()->create(['scope' => $scope, 'title' => $title, 'status' => $status]);
    }

    public function test_anyone_logs_an_item_on_queue_by_default()
    {
        $this->actingAs($this->ana)
            ->post(route('items.store'), ['scope' => 'company', 'code' => '7937', 'title' => 'Portal user links', 'notes' => 'Copy on rewrite'])
            ->assertSessionHasNoErrors();

        $item = Item::query()->sole();
        $this->assertSame([$this->ana->id, 'company', '7937', 'Portal user links', 'queue'],
            [$item->user_id, $item->scope, $item->code, $item->title, $item->status]);

        $this->actingAs($this->ana)->post(route('items.store'), ['scope' => 'team', 'title' => ''])
            ->assertSessionHasErrors(['scope', 'title']);
    }

    public function test_the_list_shows_my_items_and_company_items_but_not_others_personal_ones()
    {
        $this->item($this->ana, 'personal', 'Ana private');
        $this->item($this->ben, 'personal', 'Ben private');
        $this->item($this->ben, 'company', 'Ben shared', 'progress');

        $this->actingAs($this->ana)->get(route('items.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('items/index')
                ->has('items', 2)
                ->where('counts.queue', 1)
                ->where('counts.progress', 1)
                ->where('counts.hold', 0)
                ->where('counts.done', 0));

        $this->actingAs($this->ana)->get(route('items.index', ['scope' => 'company', 'status' => 'progress']))
            ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.title', 'Ben shared'));
    }

    public function test_a_personal_item_is_closed_to_everyone_else()
    {
        $item = $this->item($this->ben, 'personal');

        $this->actingAs($this->ana)->get(route('items.show', $item))->assertForbidden();
        $this->actingAs($this->ana)->patch(route('items.status', $item), ['status' => 'done'])->assertForbidden();
        $this->actingAs($this->ben)->get(route('items.show', $item))->assertOk()
            ->assertInertia(fn ($page) => $page->component('items/show')->where('item.title', 'Fix login'));
    }

    public function test_anyone_moves_a_company_item_but_only_its_creator_or_hr_edits_or_deletes_it()
    {
        $item = $this->item($this->ben, 'company');

        $this->actingAs($this->ana)->patch(route('items.status', $item), ['status' => 'hold'])->assertSessionHasNoErrors();
        $this->assertSame('hold', $item->fresh()->status);
        $this->actingAs($this->ana)->patch(route('items.status', $item), ['status' => 'later'])->assertSessionHasErrors('status');

        $this->actingAs($this->ana)->put(route('items.update', $item), ['scope' => 'company', 'title' => 'Mine now'])->assertForbidden();
        $this->actingAs($this->ana)->delete(route('items.destroy', $item))->assertForbidden();

        $this->actingAs($this->ben)->put(route('items.update', $item), ['scope' => 'company', 'code' => 'A-1', 'title' => 'Renamed'])
            ->assertSessionHasNoErrors();
        $this->assertSame(['A-1', 'Renamed'], [$item->fresh()->code, $item->fresh()->title]);

        $this->actingAs(User::factory()->hr()->create())->delete(route('items.destroy', $item))->assertRedirect();
        $this->assertDatabaseCount('items', 0);
    }
}
