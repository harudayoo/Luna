<?php

namespace Tests\Feature\Pet;

use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\MoonQuests;
use App\Services\Moonlings;
use App\Services\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Seven more eggs (spec 2026-11-26-luna-moonling-collection, slice 15), each at its edge: sun (100 visit days),
 * planet (3 moonlings at Bright), meteor (50 duel wins), galaxy (every one-time quest), orchid (pats on 30 days),
 * moonflower (5 moonlings), citylight (visits in 6 different months). "Now" is Thu 2026-11-19 10:00 Manila.
 */
class EggKindsTest extends TestCase
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

    private function has(string $kind): bool
    {
        return Moonling::query()->where('user_id', $this->ana->id)->where('source', $kind)->exists();
    }

    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-05-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    /** `n` rows of a kind on distinct days going back from 2026-11-18, every day (weekends too). */
    private function days(string $kind, int $n, int $skip = 0): void
    {
        $d = CarbonImmutable::parse('2026-11-18')->subDays($skip);
        foreach (range(1, $n) as $ignored) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => $kind, 'ref' => $d->toDateString(), 'xp' => 0]);
            $d = $d->subDay();
        }
    }

    public function test_sun_comes_with_visits_on_100_days()
    {
        $this->days('visit', 99);
        $this->check();
        $this->assertFalse($this->has('sun'));

        $this->days('visit', 1, 99);
        $this->check();
        $this->assertTrue($this->has('sun'));
    }

    public function test_planet_comes_with_three_moonlings_at_bright()
    {
        $xp = fn (Moonling $m, int $xp) => PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => $m->id, 'kind' => 'leave', 'ref' => "m{$m->id}-{$xp}", 'xp' => $xp]);
        $a = Moonlings::active($this->ana);
        $b = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);
        $c = Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'comet', 'source' => 'comet']);
        $xp($a, Pet::STAGES[3]);
        $xp($b, Pet::STAGES[3]);
        $xp($c, Pet::STAGES[3] - 1);
        $this->check();
        $this->assertFalse($this->has('planet'));

        $xp($c, 1);
        $this->check();
        $this->assertTrue($this->has('planet'));
    }

    public function test_meteor_comes_with_50_duel_wins()
    {
        $win = fn () => PetDuel::query()->create([
            'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
            'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-09-01 02:00:00',
        ]);
        foreach (range(1, 49) as $ignored) {
            $win();
        }
        $this->check();
        $this->assertFalse($this->has('meteor'));

        $win();
        $this->check();
        $this->assertTrue($this->has('meteor'));
    }

    public function test_galaxy_comes_with_every_one_time_quest()
    {
        // Each quest's reward ref (`dye:…` or, since slice 18, `shade:…`).
        $oneTime = collect(MoonQuests::QUESTS)->reject(fn (array $q) => $q['seasonal'])->map(fn (array $q) => MoonQuests::ref($q))->values();
        foreach ($oneTime->slice(1) as $ref) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => $ref, 'xp' => 0]);
        }
        $this->check();
        $this->assertFalse($this->has('galaxy'));

        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'unlock', 'ref' => $oneTime->first(), 'xp' => 0]);
        $this->check();
        $this->assertTrue($this->has('galaxy'));
    }

    public function test_orchid_comes_with_pats_on_30_days()
    {
        $this->days('pat', 29);
        $this->check();
        $this->assertFalse($this->has('orchid'));

        $this->days('pat', 1, 29);
        $this->check();
        $this->assertTrue($this->has('orchid'));
    }

    public function test_moonflower_comes_with_five_moonlings()
    {
        Moonlings::active($this->ana);
        foreach (['star', 'comet', 'eclipse'] as $kind) {
            Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => $kind, 'source' => $kind]);
        }
        $this->check();
        $this->assertFalse($this->has('moonflower'));

        Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'aurora', 'source' => 'aurora']);
        $this->check();
        $this->assertTrue($this->has('moonflower'));
    }

    public function test_citylight_comes_with_visits_in_six_different_months()
    {
        foreach (['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10', '2026-10-20'] as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $d, 'xp' => 0]);
        }
        $this->check();
        $this->assertFalse($this->has('citylight'));

        Pet::visit($this->ana); // November: the sixth month
        $this->assertTrue($this->has('citylight'));
    }

    public function test_the_nest_lists_all_eleven_eggs_and_each_gets_a_bell_notice()
    {
        $this->assertSame(
            ['star', 'comet', 'eclipse', 'aurora', 'nova', 'sun', 'planet', 'meteor', 'galaxy', 'orchid', 'moonflower', 'citylight'],
            array_keys(Moonlings::EGGS),
        );
        $this->days('pat', 30);
        $this->check();
        $this->assertTrue($this->ana->fresh()->notifications()->get()->contains(fn ($n) => $n->data['body'] === 'An orchid egg appeared in your moon nest.'));
    }
}
