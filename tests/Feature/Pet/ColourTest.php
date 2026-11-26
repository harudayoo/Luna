<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * More colours (spec 2026-11-26-luna-moonling-collection, slice 17): four shades (coral and lilac open), metallic dyes
 * for 1st/2nd/3rd in a weekly Moon Cup, and holiday dyes from seasonal quests. "Now" is Thu 2026-11-19 10:00 Manila;
 * last office week is Nov 9–13.
 */
class ColourTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
    }

    /** @return list<string> */
    private function dyes(User $u): array
    {
        return PetEvent::query()->where('user_id', $u->id)->where('kind', 'unlock')->where('ref', 'like', 'dye:%')
            ->orderBy('ref')->pluck('ref')->map(fn ($r) => substr($r, 4))->all();
    }

    private function duel(User $winner, User $loser, string $at = '2026-11-11 02:00:00'): void
    {
        PetDuel::query()->create([
            'challenger_id' => $winner->id, 'opponent_id' => $loser->id, 'challenger_pick' => 'moon',
            'opponent_pick' => 'star', 'winner_id' => $winner->id, 'status' => 'done', 'answered_at' => $at,
        ]);
    }

    public function test_the_new_shades_two_open_two_by_quest()
    {
        $this->assertSame([
            'classic', 'dusk', 'dawn', 'tide', 'mist', 'mint', 'coral', 'lilac',
            'sakura', 'ember', 'frost', 'cocoa', 'midnight', 'gold', 'nebula', 'ocean', 'peach', 'prism',
        ], Moonlings::PALETTES);
        $this->assertArrayHasKey('ocean', Moonlings::SHADE_UNLOCKS);
        $this->assertArrayHasKey('peach', Moonlings::SHADE_UNLOCKS);

        $moon = Moonlings::active($this->ana);
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['palette' => 'coral'])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['palette' => 'ocean'])->assertSessionHasErrors('palette');
    }

    public function test_metallic_dyes_for_first_second_and_third_in_last_weeks_cup()
    {
        [$ben, $cy, $di, $ed] = User::factory()->count(4)->create()->all();
        // Last week: Ben 3 wins, Cy 2, Ana 2 (tied 2nd), Di 1, Ed 0.
        foreach ([[$ben, $ed], [$ben, $ed], [$ben, $ed], [$cy, $ed], [$cy, $ed], [$this->ana, $ed], [$this->ana, $ed], [$di, $ed]] as [$w, $l]) {
            $this->duel($w, $l);
        }
        // This week's wins don't count for last week's cup.
        $this->duel($ed, $ben, '2026-11-17 02:00:00');

        foreach ([$ben, $cy, $this->ana, $di, $ed] as $u) {
            Pet::award($u, 'leave', 'check', 0);
        }

        $this->assertContains('gold', $this->dyes($ben));
        $this->assertContains('silver', $this->dyes($cy));
        $this->assertContains('silver', $this->dyes($this->ana));
        $this->assertContains('bronze', $this->dyes($di));
        $this->assertEmpty(array_intersect(['gold', 'silver', 'bronze'], $this->dyes($ed)));
    }

    public function test_holiday_dyes_come_from_seasonal_quests_in_their_week()
    {
        $visit = function (string $utc) {
            $this->travelTo($utc);
            Pet::visit($this->ana);
        };

        $visit('2026-10-23 02:00:00'); // Fri Oct 23: before pumpkin week
        $this->assertNotContains('pumpkin', $this->dyes($this->ana));
        $visit('2026-10-26 02:00:00'); // Mon Oct 26
        $this->assertContains('pumpkin', $this->dyes($this->ana));

        $visit('2026-12-21 02:00:00'); // Mon Dec 21
        $this->assertContains('pine', $this->dyes($this->ana));

        $visit('2027-02-09 02:00:00'); // Tue Feb 9: the day before heart week
        $this->assertNotContains('heart', $this->dyes($this->ana));
        $visit('2027-02-12 02:00:00'); // Fri Feb 12
        $this->assertContains('heart', $this->dyes($this->ana));
    }

    public function test_the_dye_list_with_how_each_is_earned()
    {
        $this->assertSame([
            'default', 'sun', 'ruby', 'leaf', 'sky', 'rose', 'night', 'starlight', 'cloud', 'berry',
            'gold', 'silver', 'bronze', 'fiesta', 'parol', 'pumpkin', 'pine', 'heart',
        ], Moonlings::DYES);

        $wardrobe = Moonlings::wardrobe($this->ana);
        $how = collect($wardrobe['dyes'])->pluck('how', 'key');
        $this->assertSame('Place 2nd in a weekly Moon Cup', $how['silver']);
        $this->assertStringContainsString('October', $how['pumpkin']);
    }
}
