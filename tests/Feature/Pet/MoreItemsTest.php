<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Nine more items (spec 2026-11-26-luna-moonling-collection, slice 16), each unlocked at its edge; the flower crown and
 * the orchid pin are open. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class MoreItemsTest extends TestCase
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

    /** @return list<string> */
    private function unlocked(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')->pluck('ref')->all();
    }

    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-06-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    private function row(string $kind, string $ref, ?string $at = null): void
    {
        // forceCreate: `created_at` isn't fillable, and the coffee test needs a time of day.
        PetEvent::query()->forceCreate(['user_id' => $this->ana->id, 'kind' => $kind, 'ref' => $ref, 'xp' => 0] + ($at ? ['created_at' => $at] : []));
    }

    public function test_the_new_items_sit_in_their_slots_and_two_are_open()
    {
        $slots = collect(Moonlings::WEAR)->map(fn (array $w) => $w['slot'])->only([
            'jetpack', 'umbrella', 'flower_crown', 'bowtie', 'orchid_pin', 'coffee', 'headphones', 'kite', 'monocle',
        ])->all();
        $this->assertSame([
            'jetpack' => 'back', 'umbrella' => 'hand', 'flower_crown' => 'head', 'bowtie' => 'neck', 'orchid_pin' => 'head',
            'coffee' => 'hand', 'headphones' => 'head', 'kite' => 'hand', 'monocle' => 'face',
        ], $slots);

        $moon = Moonlings::active($this->ana);
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['wear' => ['flower_crown']])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['wear' => ['orchid_pin', 'bowtie']])->assertSessionHasErrors('wear');
    }

    public function test_jetpack_with_a_15_day_streak()
    {
        $days = [];
        for ($d = CarbonImmutable::parse('2026-11-18'); count($days) < 14; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $days[] = $d->toDateString();
            }
        }
        foreach (array_slice($days, 0, 13) as $d) {
            $this->row('visit', $d);
        }
        Pet::visit($this->ana); // 14
        $this->assertNotContains('jetpack', $this->unlocked());

        $this->row('visit', $days[13]); // the streak now reaches back one more office day: 15
        $this->check();
        $this->assertContains('jetpack', $this->unlocked());
    }

    public function test_umbrella_with_visits_on_5_rainy_season_days()
    {
        foreach (['2026-06-01', '2026-07-01', '2026-08-03', '2026-10-30', '2026-11-02', '2026-05-29'] as $d) {
            $this->row('visit', $d);
        }
        $this->check();
        $this->assertNotContains('umbrella', $this->unlocked());

        $this->row('visit', '2026-09-15');
        $this->check();
        $this->assertContains('umbrella', $this->unlocked());
    }

    public function test_bowtie_with_3_moon_quests_done()
    {
        $this->row('unlock', 'dye:leaf');
        $this->row('unlock', 'dye:sky');
        $this->row('unlock', 'shade:frost'); // not a quest
        $this->check();
        $this->assertNotContains('bowtie', $this->unlocked());

        $this->row('unlock', 'dye:ruby');
        $this->check();
        $this->assertContains('bowtie', $this->unlocked());
    }

    public function test_coffee_with_visits_before_nine_on_10_days()
    {
        // 08:59 Manila is 00:59 UTC; 09:00 Manila doesn't count.
        foreach (range(1, 9) as $i) {
            $this->row('visit', sprintf('2026-10-%02d', $i), sprintf('2026-10-%02d 00:59:00', $i));
        }
        $this->row('visit', '2026-10-20', '2026-10-20 01:00:00');
        $this->check();
        $this->assertNotContains('coffee', $this->unlocked());

        $this->row('visit', '2026-10-21', '2026-10-20 23:30:00'); // 07:30 Manila on the 21st
        $this->check();
        $this->assertContains('coffee', $this->unlocked());
    }

    public function test_headphones_kite_and_monocle()
    {
        foreach (range(1, 4) as $i) {
            $this->row('weekly', "visits:2026-10-0{$i}");
        }
        $win = fn () => PetDuel::query()->create([
            'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
            'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-09-01 02:00:00',
        ]);
        foreach (range(1, 9) as $ignored) {
            $win();
        }
        PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => Moonlings::active($this->ana)->id, 'kind' => 'leave', 'ref' => 'x', 'xp' => Pet::STAGES[4] - 1]);
        $this->check();
        $this->assertEmpty(array_intersect(['headphones', 'kite', 'monocle'], $this->unlocked()));

        $this->row('weekly', 'visits:2026-10-05');
        $win();
        PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => Moonlings::active($this->ana)->id, 'kind' => 'leave', 'ref' => 'y', 'xp' => 1]);
        $this->check();
        $this->assertEqualsCanonicalizing(['headphones', 'kite', 'monocle'], array_values(array_intersect(['headphones', 'kite', 'monocle'], $this->unlocked())));
    }
}
