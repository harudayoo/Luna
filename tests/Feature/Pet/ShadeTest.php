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
 * Shades (spec 2026-11-26-luna-moonling-style, slice 9): fixed art colours, six open and eight unlocked by
 * pats, a streak, duel wins, XP, hatching, Full Moon, the Moon Cup and having all the rest. Unlocks are recorded
 * once (ref `shade:{key}`) and last. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class ShadeTest extends TestCase
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

    private function dress(array $data)
    {
        return $this->actingAs($this->ana)->patch(route('pet.moonlings.update', Moonlings::active($this->ana)), $data);
    }

    /** @return list<string> Ana's unlocked shades */
    private function shades(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')
            ->where('ref', 'like', 'shade:%')->orderBy('ref')->pluck('ref')
            ->map(fn (string $r) => substr($r, 6))->all();
    }

    /** A new 0-XP award, so the unlocks are checked. */
    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-01-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    private function xp(Moonling $m, int $xp, string $ref): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => $m->id, 'kind' => 'leave', 'ref' => $ref, 'xp' => $xp]);
    }

    private function wins(int $n): void
    {
        foreach (range(1, $n) as $i) {
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

    public function test_the_open_shades_can_be_worn_from_the_start()
    {
        foreach (['classic', 'dusk', 'dawn', 'tide', 'mist', 'mint'] as $shade) {
            $this->dress(['palette' => $shade])->assertSessionHasNoErrors();
            $this->assertSame($shade, Moonlings::active($this->ana)->fresh()->palette);
        }
    }

    public function test_a_locked_shade_is_refused_until_it_is_unlocked()
    {
        $this->dress(['palette' => 'gold'])->assertSessionHasErrors('palette');
        $this->assertSame('classic', Moonlings::active($this->ana)->fresh()->palette);

        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => 'shade:gold', 'xp' => 0]);
        $this->dress(['palette' => 'gold'])->assertSessionHasNoErrors();
        $this->assertSame('gold', Moonlings::active($this->ana)->fresh()->palette);
    }

    public function test_sakura_comes_with_pats_on_ten_days()
    {
        foreach ($this->officeDays(9) as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'pat', 'ref' => $d, 'xp' => 0]);
        }
        $this->check();
        $this->assertNotContains('sakura', $this->shades());

        Pet::pat($this->ana); // the tenth day
        $this->assertContains('sakura', $this->shades());
    }

    public function test_ember_comes_with_a_twenty_day_streak()
    {
        // 19 office days in a row before today: a 19-day streak.
        foreach ($this->officeDays(19) as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $d, 'xp' => 0]);
        }
        $this->check();
        $this->assertNotContains('ember', $this->shades());

        Pet::visit($this->ana); // today: the 20th day in a row
        $this->assertContains('ember', $this->shades());
    }

    public function test_frost_comes_with_ten_duel_wins()
    {
        $this->wins(9);
        $this->check();
        $this->assertNotContains('frost', $this->shades());

        $this->wins(1);
        $this->check();
        $this->assertContains('frost', $this->shades());
    }

    public function test_cocoa_comes_with_500_xp_across_all_moonlings()
    {
        $moon = Moonlings::active($this->ana);
        $star = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);
        $this->xp($moon, 300, 'a');
        $this->xp($star, 199, 'b');
        $this->check();
        $this->assertNotContains('cocoa', $this->shades());

        $this->xp($star, 1, 'c');
        $this->check();
        $this->assertContains('cocoa', $this->shades());
    }

    public function test_midnight_comes_with_three_hatched_moonlings()
    {
        $moon = Moonlings::active($this->ana);
        $star = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);
        $comet = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'comet', 'source' => 'comet']);
        $this->xp($moon, Pet::STAGES[1], 'a');
        $this->xp($star, Pet::STAGES[1], 'b');
        $this->xp($comet, Pet::STAGES[1] - 1, 'c');
        $this->check();
        $this->assertNotContains('midnight', $this->shades());

        $this->xp($comet, 1, 'd');
        $this->check();
        $this->assertContains('midnight', $this->shades());
    }

    public function test_gold_comes_with_a_full_moon()
    {
        $moon = Moonlings::active($this->ana);
        $this->xp($moon, Pet::STAGES[4] - 1, 'a');
        $this->check();
        $this->assertNotContains('gold', $this->shades());

        $this->xp($moon, 1, 'b');
        $this->check();
        $this->assertContains('gold', $this->shades());
    }

    public function test_nebula_comes_with_a_moon_cup_and_prism_with_every_other_shade()
    {
        // Last office week (Nov 9–13): Ana won the most duels.
        PetDuel::query()->create([
            'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
            'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-11-11 02:00:00',
        ]);
        // (Ocean and peach, slice 17, come from quests: unlocked here directly.)
        foreach (['sakura', 'ember', 'frost', 'cocoa', 'midnight', 'gold', 'ocean', 'peach'] as $s) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => "shade:{$s}", 'xp' => 0]);
        }
        $this->check();
        $this->assertSame(['cocoa', 'ember', 'frost', 'gold', 'midnight', 'nebula', 'ocean', 'peach', 'prism', 'sakura'], $this->shades());

        // Nothing is doubled, and nothing gives XP.
        $this->check();
        $this->assertSame(10, PetEvent::query()->where('ref', 'like', 'shade:%')->count());
        $this->assertSame(0, (int) PetEvent::query()->where('kind', 'unlock')->sum('xp'));
    }

    public function test_the_wardrobe_lists_every_shade_with_whether_it_is_open_and_how_to_unlock_it()
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => 'shade:frost', 'xp' => 0]);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    ->where('pet_detail.wardrobe.palettes', fn ($p) => collect($p)->pluck('key')->all() === [
                        'classic', 'dusk', 'dawn', 'tide', 'mist', 'mint', 'coral', 'lilac',
                        'sakura', 'ember', 'frost', 'cocoa', 'midnight', 'gold', 'nebula', 'ocean', 'peach', 'prism',
                    ])
                    ->where('pet_detail.wardrobe.palettes.0.unlocked', true)
                    ->where('pet_detail.wardrobe.palettes.0.how', null)
                    // (Coral and lilac, slice 17, are open and listed before the locked ones.)
                    ->where('pet_detail.wardrobe.palettes.8.key', 'sakura')
                    ->where('pet_detail.wardrobe.palettes.8.unlocked', false)
                    ->where('pet_detail.wardrobe.palettes.8.how', 'Pat your moonling on 10 days')
                    ->where('pet_detail.wardrobe.palettes.10.key', 'frost')
                    ->where('pet_detail.wardrobe.palettes.10.unlocked', true)));
    }
}
