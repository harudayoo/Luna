<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\MoonQuests;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * More quests (spec 2026-11-26-luna-moonling-collection, slice 18): four one-time quests (two pay a shade), three weekly
 * quests that pay 5 XP once a week and reset on Monday, and a quest streak badge on the board. "Now" is
 * Thu 2026-11-19 10:00 Manila (week of Mon Nov 16).
 */
class QuestsMoreTest extends TestCase
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
    private function unlocked(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')->pluck('ref')->all();
    }

    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-07-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    private function row(string $kind, string $ref, int $xp = 0): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => $kind, 'ref' => $ref, 'xp' => $xp]);
    }

    private function duel(User $a, User $b, string $at = '2026-10-01 02:00:00'): void
    {
        PetDuel::query()->create([
            'challenger_id' => $a->id, 'opponent_id' => $b->id, 'challenger_pick' => 'moon', 'opponent_pick' => 'star',
            'winner_id' => $a->id, 'status' => 'done', 'answered_at' => $at,
        ]);
    }

    public function test_social_pays_peach_for_duels_with_5_different_people()
    {
        $others = User::factory()->count(5)->create();
        foreach ($others->take(4) as $i => $o) {
            $i % 2 ? $this->duel($this->ana, $o) : $this->duel($o, $this->ana);
        }
        $this->duel($this->ana, $others[0]); // the same person again
        $this->check();
        $this->assertNotContains('shade:peach', $this->unlocked());

        $this->duel($others[4], $this->ana);
        $this->check();
        $this->assertContains('shade:peach', $this->unlocked());
    }

    public function test_full_outfit_pays_ocean_when_every_spot_is_worn()
    {
        foreach (['bow', 'wings', 'scarf'] as $item) {
            $this->row('unlock', $item);
        }
        $moon = Moonlings::active($this->ana);
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['wear' => ['bow', 'glasses', 'scarf', 'wings']]);
        $this->assertNotContains('shade:ocean', $this->unlocked());

        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['wear' => ['bow', 'glasses', 'scarf', 'wings', 'balloon']])
            ->assertSessionHasNoErrors();
        $this->assertContains('shade:ocean', $this->unlocked());
        $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['palette' => 'ocean'])->assertSessionHasNoErrors();
    }

    public function test_patter_pays_cloud_for_pats_on_20_days_and_mondays_pays_berry_for_3_in_a_row()
    {
        foreach (range(1, 19) as $i) {
            $this->row('pat', sprintf('2026-10-%02d', $i));
        }
        // Mondays: Nov 2 and Nov 9 (Oct 26 missing), then Nov 16.
        foreach (['2026-10-19', '2026-11-02', '2026-11-09'] as $d) {
            $this->row('visit', $d);
        }
        $this->check();
        $this->assertNotContains('dye:cloud', $this->unlocked());
        $this->assertNotContains('dye:berry', $this->unlocked());

        $this->row('pat', '2026-10-20');
        $this->row('visit', '2026-11-16');
        $this->check();
        $this->assertContains('dye:cloud', $this->unlocked());
        $this->assertContains('dye:berry', $this->unlocked());
    }

    public function test_weekly_quests_pay_5_xp_once_a_week_and_reset_on_monday()
    {
        $foe = User::factory()->create();
        foreach (['2026-11-16', '2026-11-17', '2026-11-18'] as $d) {
            $this->row('visit', $d);
        }
        $this->row('pat', '2026-11-16');
        Pet::pat($this->ana); // 2 pat days
        $this->duel($foe, $this->ana, '2026-11-18 02:00:00');
        Pet::visit($this->ana); // 4 visit days

        $weekly = fn () => PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'weekly')
            ->orderBy('ref')->pluck('xp', 'ref')->map(fn ($xp) => (int) $xp)->all();
        $this->assertSame(['duel:2026-11-16' => 5, 'pats:2026-11-16' => 5, 'visits:2026-11-16' => 5], $weekly());

        $this->check();
        $this->assertCount(3, $weekly(), 'once a week');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_weekly')
                ->reloadOnly('pet_weekly', fn (AssertableInertia $reload) => $reload
                    ->where('pet_weekly.quests', fn ($q) => collect($q)->pluck('key')->all() === ['visits', 'duel', 'pats']
                        && collect($q)->every(fn ($row) => $row['done'] && $row['xp'] === 5))
                    ->where('pet_weekly.streak', 1)));

        // Next Monday: fresh progress.
        $this->travelTo('2026-11-23 02:00:00');
        $this->assertSame([[0, 4, false], [0, 1, false], [0, 2, false]], collect(MoonQuests::weekly($this->ana)['quests'])
            ->map(fn ($r) => [$r['progress'], $r['target'], $r['done']])->all());
    }

    public function test_the_quest_streak_counts_full_weeks_in_a_row_and_shows_on_the_board()
    {
        foreach (['2026-11-02', '2026-11-09'] as $monday) {
            foreach (['visits', 'duel', 'pats'] as $key) {
                $this->row('weekly', "{$key}:{$monday}", 5);
            }
        }
        $this->row('weekly', 'visits:2026-10-26', 5); // an incomplete week before: not part of the streak
        $this->assertSame(2, MoonQuests::streak($this->ana));

        $this->ana->forceFill(['pet_public' => true])->save();
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.rows.0.quest_streak', 2)));
    }

    public function test_weekly_xp_reads_well_in_the_recent_list()
    {
        $this->row('weekly', 'duel:2026-11-16', 5);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    ->where('pet_detail.recent', fn ($recent) => collect($recent)->contains(fn ($r) => $r['label'] === 'Weekly quest: finish a duel'))));
    }
}
