<?php

namespace Tests\Feature\Pet;

use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The wardrobe (spec 2026-11-25-luna-moonling-life, slice 7): shades built from tokens (all open), and head and neck
 * items unlocked by duel wins (5 / 15 / 30), a 10-day streak and naming. Unlocks are recorded once and last; only
 * your own moonlings, only unlocked items, one head and one neck item. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class WardrobeTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $foe;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->foe = User::factory()->create(['name' => 'Foe Lim']);
    }

    private function dress(Moonling $m, array $data)
    {
        return $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $m), $data);
    }

    /** Lifetime duel wins for Ana, answered long ago. */
    private function wins(int $n): void
    {
        foreach (range(1, $n) as $i) {
            PetDuel::query()->create([
                'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
                'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-09-01 02:00:00',
            ]);
        }
    }

    private function unlock(string $item): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => $item, 'xp' => 0]);
    }

    /** @return list<string> the slice 7 items unlocked (shades are in ShadeTest; newer items and dyes in ItemDyeTest) */
    private function unlocked(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')
            ->whereIn('ref', ['bow', 'comet_trail', 'halo', 'scarf', 'star_clip'])->orderBy('ref')->pluck('ref')->all();
    }

    /** A new award, so the unlocks are checked. */
    private function award(string $ref): void
    {
        Pet::award($this->ana, 'leave', $ref);
    }

    public function test_a_shade_is_saved_on_your_own_moonling_only()
    {
        $moon = Moonlings::active($this->ana);
        $egg = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);

        $this->dress($moon, ['palette' => 'dusk'])->assertSessionHasNoErrors();
        $this->dress($egg, ['palette' => 'tide'])->assertSessionHasNoErrors();
        $this->assertSame(['dusk', 'tide'], [$moon->fresh()->palette, $egg->fresh()->palette]);

        $this->dress($moon, ['palette' => 'neon'])->assertSessionHasErrors('palette');
        $this->assertSame('dusk', $moon->fresh()->palette);

        $this->dress(Moonlings::active($this->foe), ['palette' => 'mist'])->assertNotFound();
        $this->assertSame('classic', Moonlings::active($this->foe)->fresh()->palette);
    }

    public function test_only_unlocked_items_can_be_worn_and_never_the_crown()
    {
        $moon = Moonlings::active($this->ana);

        $this->dress($moon, ['wear' => ['star_clip']])->assertSessionHasErrors('wear');
        $this->dress($moon, ['wear' => ['crown']])->assertSessionHasErrors('wear');
        $this->dress($moon, ['wear' => ['cape']])->assertSessionHasErrors('wear');
        $this->assertSame([], $moon->fresh()->wear);

        $this->wins(5);
        $this->award('2026-12-01');
        $this->dress($moon, ['wear' => ['star_clip']])->assertSessionHasNoErrors();
        $this->assertSame(['star_clip'], $moon->fresh()->wear);
    }

    public function test_at_most_one_head_and_one_neck_item()
    {
        $moon = Moonlings::active($this->ana);
        foreach (['bow', 'star_clip', 'scarf', 'comet_trail'] as $item) {
            $this->unlock($item);
        }

        $this->dress($moon, ['wear' => ['bow', 'star_clip']])->assertSessionHasErrors('wear');
        $this->dress($moon, ['wear' => ['scarf', 'comet_trail']])->assertSessionHasErrors('wear');
        $this->dress($moon, ['wear' => ['bow', 'scarf']])->assertSessionHasNoErrors();
        $this->assertSame(['bow', 'scarf'], $moon->fresh()->wear);

        $this->dress($moon, ['wear' => []])->assertSessionHasNoErrors();
        $this->assertSame([], $moon->fresh()->wear);
    }

    public function test_unlocks_come_from_wins_a_streak_and_naming_once_each_and_last()
    {
        // Naming gives the bow, and clearing the name doesn't take it back.
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => 'Mochi']);
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => '']);
        $this->assertSame(['bow'], $this->unlocked());

        // Wins: 14 gives the star clip only, 15 the comet trail, 30 the halo.
        $this->wins(14);
        $this->award('2026-12-01');
        $this->assertSame(['bow', 'star_clip'], $this->unlocked());
        $this->wins(1);
        $this->award('2026-12-02');
        $this->assertSame(['bow', 'comet_trail', 'star_clip'], $this->unlocked());
        $this->wins(15);
        $this->award('2026-12-03');
        $this->assertSame(['bow', 'comet_trail', 'halo', 'star_clip'], $this->unlocked());

        // A 10-office-day streak: 9 office days before today, then today's visit.
        $days = [];
        for ($d = CarbonImmutable::parse('2026-11-18'); count($days) < 9; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $days[] = $d->toDateString();
            }
        }
        foreach ($days as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $d, 'xp' => 0]);
        }
        $this->actingAs($this->ana)->get(route('dashboard'));
        $this->assertSame(['bow', 'comet_trail', 'halo', 'scarf', 'star_clip'], $this->unlocked());

        // Weeks later, the streak long broken: nothing is taken back, nothing doubled, no XP, not in the XP list.
        $this->travelTo('2026-12-10 02:00:00');
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                // (The visit fixtures above carry 0 XP, so look for the unlocks by their label, not their XP.)
                ->where('pet_detail.recent', fn ($recent) => collect($recent)->doesntContain(fn ($r) => str_contains(strtolower($r['label']), 'unlock')))));
        $this->assertSame(['bow', 'comet_trail', 'halo', 'scarf', 'star_clip'], $this->unlocked());
        $this->assertSame(0, (int) PetEvent::query()->where('kind', 'unlock')->sum('xp'));
    }

    public function test_the_wardrobe_lists_every_shade_and_item_with_how_to_unlock_it()
    {
        $this->unlock('scarf');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_detail')
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    // The shades (slice 9) are listed in ShadeTest.
                    ->has('pet_detail.wardrobe.palettes', 14)
                    ->has('pet_detail.wardrobe.items', 12)
                    ->where('pet_detail.wardrobe.items.0.key', 'star_clip')
                    ->where('pet_detail.wardrobe.items.0.slot', 'head')
                    ->where('pet_detail.wardrobe.items.0.unlocked', false)
                    ->has('pet_detail.wardrobe.items.0.how')
                    ->where('pet_detail.wardrobe.items.3.key', 'scarf')
                    ->where('pet_detail.wardrobe.items.3.slot', 'neck')
                    ->where('pet_detail.wardrobe.items.3.unlocked', true)));
    }

    public function test_the_shade_and_items_show_on_home_the_board_duels_and_the_nest()
    {
        foreach ([$this->ana, $this->foe] as $u) {
            $u->forceFill(['pet_public' => true])->save();
        }
        $this->unlock('bow');
        $moon = Moonlings::active($this->ana);
        $this->dress($moon, ['palette' => 'tide', 'wear' => ['bow']])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->post(route('pet.duels.store'), ['opponent_id' => $this->foe->id, 'pick' => 'moon']);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pet.palette', 'tide')->where('pet.wear', ['bow'])
                ->reloadOnly('pet_nest', fn (AssertableInertia $reload) => $reload
                    ->where('pet_nest.moonlings.0.palette', 'tide')
                    ->where('pet_nest.moonlings.0.wear', ['bow'])));

        $this->actingAs($this->foe)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.rows', fn ($rows) => collect($rows)->firstWhere('first_name', 'Ana')['palette'] === 'tide'
                        && collect($rows)->firstWhere('first_name', 'Ana')['wear'] === ['bow']))
                ->reloadOnly('pet_duels', fn (AssertableInertia $reload) => $reload
                    ->where('pet_duels.incoming.0.palette', 'tide')
                    ->where('pet_duels.incoming.0.wear', ['bow'])));
    }
}
