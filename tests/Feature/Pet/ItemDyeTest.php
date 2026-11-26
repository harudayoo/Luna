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
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Items all over and dyes (spec 2026-11-26-luna-moonling-style, slice 10): five slots (head, face, neck, back,
 * hand), seven new items (two open), and dyes (slice 12: paid by quests, MoonQuestTest) remembered per item on each moonling
 * (`moonlings.dyes`). Unlocks are recorded once (items by key, dyes as `dye:{key}`) and last.
 * "Now" is Thu 2026-11-19 10:00 Manila.
 */
class ItemDyeTest extends TestCase
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

    private function dress(array $data, ?Moonling $m = null)
    {
        return $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $m ?? Moonlings::active($this->ana)), $data);
    }

    private function unlock(string $ref): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => $ref, 'xp' => 0]);
    }

    /** @return list<string> */
    private function unlocked(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')->pluck('ref')->all();
    }

    /** A new 0-XP award, so the unlocks are checked. */
    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-02-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    private function xp(Moonling $m, int $xp, string $ref): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => $m->id, 'kind' => 'leave', 'ref' => $ref, 'xp' => $xp]);
    }

    private function wins(int $n): void
    {
        foreach (range(1, $n) as $ignored) {
            PetDuel::query()->create([
                'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
                'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-09-01 02:00:00',
            ]);
        }
    }

    /** `n` office days before today, newest first. */
    private function officeDays(int $n): array
    {
        $days = [];
        for ($d = CarbonImmutable::parse('2026-11-18'); count($days) < $n; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $days[] = $d->toDateString();
            }
        }

        return $days;
    }

    private function rows(string $kind, int $n): void
    {
        foreach ($this->officeDays($n) as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => $kind, 'ref' => $d, 'xp' => 0]);
        }
    }

    public function test_the_migration_adds_dyes_and_goes_down()
    {
        $this->assertTrue(Schema::hasColumn('moonlings', 'dyes'));
        $moon = Moonlings::active($this->ana);
        $this->assertSame([], $moon->fresh()->dyes);

        // The last two: 000031 (drop users.pet_name) and this one, 000030.
        $this->artisan('migrate:rollback', ['--step' => 2])->assertSuccessful();
        $this->assertFalse(Schema::hasColumn('moonlings', 'dyes'));
        $this->assertTrue(Schema::hasColumn('moonlings', 'wear'));

        $this->artisan('migrate')->assertSuccessful();
        $this->assertTrue(Schema::hasColumn('moonlings', 'dyes'));
    }

    public function test_the_open_items_can_be_worn_from_the_start_one_per_slot()
    {
        $this->dress(['wear' => ['glasses', 'balloon']])->assertSessionHasNoErrors();
        $this->assertSame(['glasses', 'balloon'], Moonlings::active($this->ana)->fresh()->wear);

        foreach (['bow', 'scarf', 'wings', 'wand', 'cape', 'lantern'] as $item) {
            $this->unlock($item);
        }
        $this->dress(['wear' => ['bow', 'glasses', 'scarf', 'wings', 'wand']])->assertSessionHasNoErrors();
        $this->dress(['wear' => ['wings', 'cape']])->assertSessionHasErrors('wear');
        $this->dress(['wear' => ['wand', 'lantern']])->assertSessionHasErrors('wear');
        $this->assertSame(['bow', 'glasses', 'scarf', 'wings', 'wand'], Moonlings::active($this->ana)->fresh()->wear);

        $this->dress(['wear' => ['propeller']])->assertSessionHasErrors('wear');
    }

    public function test_the_new_items_unlock_at_their_edges()
    {
        $moon = Moonlings::active($this->ana);

        // Wand: one duel win. Wings: a moonling hatches. Cape: 200 XP. Lantern: a moonling reaches Bright.
        $this->xp($moon, Pet::STAGES[1] - 1, 'a');
        $this->check();
        $this->assertEmpty(array_intersect(['wand', 'wings', 'cape', 'lantern', 'propeller'], $this->unlocked()));

        $this->wins(1);
        $this->xp($moon, 1, 'b'); // 40: hatched
        $this->check();
        $this->assertEqualsCanonicalizing(['wand', 'wings'], array_values(array_intersect(['wand', 'wings', 'cape', 'lantern'], $this->unlocked())));

        $this->xp($moon, 159, 'c'); // 199
        $this->check();
        $this->assertNotContains('cape', $this->unlocked());
        $this->xp($moon, 1, 'd'); // 200
        $this->check();
        $this->assertContains('cape', $this->unlocked());

        $this->xp($moon, Pet::STAGES[3] - 201, 'e'); // one below Bright
        $this->check();
        $this->assertNotContains('lantern', $this->unlocked());
        $this->xp($moon, 1, 'f');
        $this->check();
        $this->assertContains('lantern', $this->unlocked());
    }

    public function test_the_propeller_cap_comes_with_a_five_day_streak()
    {
        $this->rows('visit', 3);
        Pet::visit($this->ana); // a 4-day streak
        $this->assertNotContains('propeller', $this->unlocked());

        $this->travelTo('2026-11-20 02:00:00');
        Pet::visit($this->ana); // Friday: 5 in a row
        $this->assertContains('propeller', $this->unlocked());
    }

    public function test_a_dye_is_kept_per_item_and_only_open_or_unlocked_dyes_on_known_items()
    {
        $moon = Moonlings::active($this->ana);
        $this->unlock('scarf');

        $this->dress(['wear' => ['scarf'], 'dyes' => ['scarf' => 'sun']])->assertSessionHasNoErrors();
        $this->dress(['dyes' => ['balloon' => 'default']])->assertSessionHasNoErrors();
        $this->assertEquals(['scarf' => 'sun', 'balloon' => 'default'], $moon->fresh()->dyes);

        $this->dress(['dyes' => ['scarf' => 'ruby']])->assertSessionHasErrors('dyes');
        $this->dress(['dyes' => ['scarf' => 'plaid']])->assertSessionHasErrors('dyes');
        $this->dress(['dyes' => ['crown' => 'sun']])->assertSessionHasErrors('dyes');
        $this->unlock('dye:ruby');
        $this->dress(['dyes' => ['scarf' => 'ruby']])->assertSessionHasNoErrors();

        // Taking the scarf off keeps its dye for next time; another moonling has its own.
        $this->dress(['wear' => []])->assertSessionHasNoErrors();
        $this->assertSame('ruby', $moon->fresh()->dyes['scarf']);
        $egg = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);
        $this->assertSame([], $egg->fresh()->dyes);

        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', Moonlings::active($this->foe)), ['dyes' => ['scarf' => 'sun']])
            ->assertNotFound();
    }

    public function test_the_wardrobe_lists_every_item_and_dye()
    {
        $this->unlock('dye:sky');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    ->where('pet_detail.wardrobe.items', fn ($items) => collect($items)->pluck('slot', 'key')->all() === [
                        'star_clip' => 'head', 'comet_trail' => 'neck', 'halo' => 'head', 'scarf' => 'neck', 'bow' => 'head',
                        'propeller' => 'head', 'glasses' => 'face', 'wings' => 'back', 'cape' => 'back',
                        'balloon' => 'hand', 'wand' => 'hand', 'lantern' => 'hand',
                        // Slice 16 (spec 2026-11-26-luna-moonling-collection).
                        'jetpack' => 'back', 'umbrella' => 'hand', 'flower_crown' => 'head', 'bowtie' => 'neck',
                        'orchid_pin' => 'head', 'coffee' => 'hand', 'headphones' => 'head', 'kite' => 'hand', 'monocle' => 'face',
                    ] && collect($items)->firstWhere('key', 'glasses')['unlocked'] === true
                      && collect($items)->firstWhere('key', 'glasses')['how'] === null
                      && collect($items)->firstWhere('key', 'wings')['how'] === 'Hatch a moonling')
                    ->where('pet_detail.wardrobe.dyes', fn ($dyes) => collect($dyes)->pluck('unlocked', 'key')->all() === [
                        'default' => true, 'sun' => true, 'ruby' => false, 'leaf' => false, 'sky' => true,
                        'rose' => false, 'night' => false, 'starlight' => false, 'cloud' => false, 'berry' => false,
                        // Slice 17 (spec 2026-11-26-luna-moonling-collection): metallic and holiday dyes.
                        'gold' => false, 'silver' => false, 'bronze' => false, 'fiesta' => false, 'parol' => false,
                        'pumpkin' => false, 'pine' => false, 'heart' => false,
                    ])));
    }

    public function test_dyes_show_on_home_the_board_duels_and_the_nest()
    {
        foreach ([$this->ana, $this->foe] as $u) {
            $u->forceFill(['pet_public' => true])->save();
        }
        $this->dress(['wear' => ['balloon'], 'dyes' => ['balloon' => 'sun']])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->post(route('pet.duels.store'), ['opponent_id' => $this->foe->id, 'pick' => 'moon']);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pet.dyes', ['balloon' => 'sun'])
                ->reloadOnly('pet_nest', fn (AssertableInertia $reload) => $reload
                    ->where('pet_nest.moonlings.0.dyes', ['balloon' => 'sun'])));

        $this->actingAs($this->foe)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.rows', fn ($rows) => collect($rows)->firstWhere('first_name', 'Ana')['dyes'] === ['balloon' => 'sun']))
                ->reloadOnly('pet_duels', fn (AssertableInertia $reload) => $reload
                    ->where('pet_duels.incoming.0.dyes', ['balloon' => 'sun'])));
    }
}
