<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Inertia\Inertia;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Duel stakes (spec 2026-11-25-luna-pet-social, slice 4, trimmed in 2026-11-25-luna-moonling-life): the house pays
 * an answered duel (win 3, draw 1, loss 1; only the first answered duel of each person's office day), and the weekly
 * Moon Cup ranks this office week's wins; last week's champion wears a crown. "Now" is Thu 2026-11-19 10:00 Manila.
 * The office week runs Mon 2026-11-16 00:00 Manila (2026-11-15 16:00 UTC) to Sun 2026-11-22 23:59:59 Manila.
 */
class PetDuelStakesTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $ben;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = $this->onBoard('Ana Cruz');
        $this->ben = $this->onBoard('Ben Reyes');
    }

    private function onBoard(string $name, bool $public = true): User
    {
        $user = User::factory()->create(['name' => $name]);
        $user->forceFill(['pet_public' => $public])->save();

        return $user;
    }

    private function play(User $from, User $to, string $mine, string $theirs): TestResponse
    {
        $this->actingAs($from)->post(route('pet.duels.store'), ['opponent_id' => $to->id, 'pick' => $mine])
            ->assertSessionHasNoErrors();
        $duel = PetDuel::query()->where('status', 'open')->where('challenger_id', $from->id)->where('opponent_id', $to->id)->sole();

        return $this->actingAs($to)->post(route('pet.duels.answer', $duel), ['pick' => $theirs]);
    }

    /** @return array<string, int> duel XP by office date */
    private function duelXp(User $user): array
    {
        return PetEvent::query()->where('user_id', $user->id)->where('kind', 'duel')
            ->orderBy('ref')->pluck('xp', 'ref')->map(fn ($xp) => (int) $xp)->all();
    }

    /** A closed duel written straight to the table: `winner` null is a draw. */
    private function closed(User $a, User $b, ?User $winner, string $answeredUtc): void
    {
        PetDuel::query()->create([
            'challenger_id' => $a->id, 'opponent_id' => $b->id, 'challenger_pick' => 'moon', 'opponent_pick' => 'star',
            'winner_id' => $winner?->id, 'status' => 'done', 'answered_at' => $answeredUtc,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function cup(User $as): array
    {
        // A plain load first, so Inertia knows the asset version the partial request has to send.
        $this->actingAs($as)->get(route('dashboard'))->assertOk();

        $cup = $this->actingAs($as)->get(route('dashboard'), [
            'X-Inertia' => 'true', 'X-Inertia-Partial-Component' => 'dashboard', 'X-Inertia-Partial-Data' => 'pet_board',
            'X-Inertia-Version' => Inertia::getVersion(),
        ])->assertOk()->json('props.pet_board.cup');
        $this->assertIsArray($cup, 'pet_board.cup is missing');

        return $cup;
    }

    public function test_a_win_pays_three_and_a_loss_pays_one_on_the_office_date()
    {
        $this->play($this->ana, $this->ben, 'moon', 'star')->assertSessionHasNoErrors(); // Moon outshines Star

        $this->assertSame(['2026-11-19' => 3], $this->duelXp($this->ana));
        $this->assertSame(['2026-11-19' => 1], $this->duelXp($this->ben));
        $this->assertSame(0, PetEvent::query()->where('xp', '<', 0)->count());
    }

    public function test_a_draw_pays_one_each()
    {
        $this->play($this->ana, $this->ben, 'comet', 'comet');

        $this->assertSame(['2026-11-19' => 1], $this->duelXp($this->ana));
        $this->assertSame(['2026-11-19' => 1], $this->duelXp($this->ben));
    }

    public function test_only_the_first_answered_duel_of_each_persons_office_day_pays()
    {
        $cy = $this->onBoard('Cy Lim');
        $this->play($this->ana, $this->ben, 'moon', 'comet');  // Comet eclipses Moon: Ana loses, 1 XP
        $this->play($cy, $this->ana, 'star', 'moon');          // Ana wins, but was already paid today; Cy's loss pays 1
        $this->play($cy, $this->ben, 'star', 'moon');          // Ben wins: both were already paid today

        $this->assertSame(['2026-11-19' => 1], $this->duelXp($this->ana));
        $this->assertSame(['2026-11-19' => 3], $this->duelXp($this->ben));
        $this->assertSame(['2026-11-19' => 1], $this->duelXp($cy));

        // 01:00 on Fri in Manila is still Thu in UTC: a new office day, so it pays again.
        $this->travelTo('2026-11-19 17:00:00');
        $this->play($this->ben, $this->ana, 'moon', 'star');   // Ben wins

        $this->assertSame(['2026-11-19' => 1, '2026-11-20' => 1], $this->duelXp($this->ana));
        $this->assertSame(['2026-11-19' => 3, '2026-11-20' => 3], $this->duelXp($this->ben));
    }

    public function test_declined_and_expired_duels_pay_nothing()
    {
        $this->actingAs($this->ana)->post(route('pet.duels.store'), ['opponent_id' => $this->ben->id, 'pick' => 'moon']);
        $this->actingAs($this->ben)->post(route('pet.duels.decline', PetDuel::query()->sole()))->assertSessionHasNoErrors();

        $this->actingAs($this->ana)->post(route('pet.duels.store'), ['opponent_id' => $this->ben->id, 'pick' => 'moon']);
        $this->travelTo('2026-11-27 02:00:00');
        $this->actingAs($this->ben)->post(route('pet.duels.answer', PetDuel::query()->where('status', 'open')->sole()), ['pick' => 'star'])
            ->assertSessionHasErrors('duel');

        $this->assertSame(0, PetEvent::query()->where('kind', 'duel')->count());
    }

    public function test_the_panel_explains_duel_xp_and_labels_it()
    {
        $this->play($this->ana, $this->ben, 'moon', 'star');

        // Loading Home records today's visit, so the duel is the second newest award.
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                ->where('pet_detail.duel_xp', ['win' => 3, 'draw' => 1, 'loss' => 1])
                ->where('pet_detail.recent.0.label', 'Daily visit')
                ->where('pet_detail.recent.1.label', 'Won a moon duel')
                ->where('pet_detail.recent.1.xp', 3)));
        $this->actingAs($this->ben)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                ->where('pet_detail.recent.1.label', 'Played a moon duel')));
    }

    public function test_the_moon_cup_ranks_this_office_weeks_wins()
    {
        $cy = $this->onBoard('Cy Lim');
        $dee = $this->onBoard('Dee Tan');
        $off = $this->onBoard('Eve Go', public: false);

        $this->closed($this->ana, $this->ben, $this->ana, '2026-11-15 15:59:59'); // Sun 23:59 Manila: last week
        $this->closed($this->ana, $this->ben, $this->ana, '2026-11-15 16:00:00'); // Mon 00:00 Manila: this week
        $this->closed($cy, $this->ben, $cy, '2026-11-16 02:00:00');
        $this->closed($cy, $this->ana, $this->ana, '2026-11-17 02:00:00');        // Ana 2 wins, 0 losses
        $this->closed($dee, $cy, $dee, '2026-11-16 01:00:00');                    // Cy 1 win, 2 losses
        $this->closed($dee, $this->ben, $dee, '2026-11-18 01:00:00');             // Dee 2 wins, last at Wed
        $this->closed($off, $this->ben, $off, '2026-11-18 01:00:00');             // not on the board: never shown
        $this->closed($this->ben, $cy, null, '2026-11-18 03:00:00');              // a draw: no win for anyone

        $cup = $this->cup($this->ana);

        // Ana and Dee both have 2 wins and 0 losses; Ana's last win (Tue) came before Dee's (Wed).
        $this->assertSame(['Ana', 'Dee', 'Cy'], array_column($cup, 'first_name'));
        $this->assertSame([1, 2, 3], array_column($cup, 'rank'));
        $this->assertSame([2, 2, 1], array_column($cup, 'wins'));
        $this->assertSame([0, 0, 2], array_column($cup, 'losses'));
        $this->assertSame([true, false, false], array_column($cup, 'me'));
        $this->assertSame($dee->id, $cup[1]['user_id']);
        $this->assertArrayHasKey('stage', $cup[0]);
        $this->assertArrayNotHasKey('xp', $cup[0]);
    }

    public function test_the_moon_cup_resets_on_monday_and_crowns_last_weeks_champion()
    {
        $cy = $this->onBoard('Cy Lim');
        $this->closed($this->ana, $this->ben, $this->ana, '2026-11-17 02:00:00');
        $this->closed($cy, $this->ben, $cy, '2026-11-17 03:00:00');
        $this->closed($this->ben, $cy, $this->ben, '2026-11-18 03:00:00');      // Ana, Cy and Ben 1 win each...
        $this->closed($this->ana, $cy, $this->ana, '2026-11-19 01:00:00');      // ...Ana 2: champion

        // No crown this week: last week nobody won.
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.crown', false));

        // Mon 00:30 Manila.
        $this->travelTo('2026-11-22 16:30:00');
        $this->assertSame([], $this->cup($this->ana));

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.crown', true)
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.rows.0.first_name', 'Ana')
                    ->where('pet_board.rows.0.crown', true)
                    ->where('pet_board.rows.1.crown', false)
                    ->where('pet_board.rows.2.crown', false)));
        $this->actingAs($this->ben)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.crown', false));
    }

    public function test_a_tie_crowns_everyone_tied_and_zero_wins_crowns_nobody()
    {
        $cy = $this->onBoard('Cy Lim');
        $this->closed($this->ana, $cy, $this->ana, '2026-11-17 02:00:00');
        $this->closed($this->ben, $cy, $this->ben, '2026-11-17 03:00:00');
        $this->closed($cy, $this->ana, null, '2026-11-18 03:00:00');

        $this->travelTo('2026-11-23 02:00:00'); // Mon 10:00 Manila
        foreach ([[$this->ana, true], [$this->ben, true], [$cy, false]] as [$who, $crown]) {
            $this->actingAs($who)->get(route('dashboard'))
                ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.crown', $crown));
        }

        // The week after, with no wins last week, nobody wears it.
        $this->travelTo('2026-11-30 02:00:00');
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.crown', false));
    }

    public function test_the_moon_cup_shows_the_top_ten_plus_your_own_row()
    {
        $people = collect(range(1, 11))->map(fn ($i) => $this->onBoard(sprintf('P%02d Person', $i)));
        // P01 wins 11, P02 wins 10 ... P11 wins 1. Ana (me) has 1 win but a loss, so she ranks last of 12.
        foreach ($people as $i => $p) {
            foreach (range(1, 11 - $i) as $n) {
                $this->closed($p, $this->ben, $p, '2026-11-17 0'.min(9, $n % 10).':00:00');
            }
        }
        $this->closed($this->ana, $this->ben, $this->ana, '2026-11-18 02:00:00');
        $this->closed($this->ana, $this->ben, $this->ben, '2026-11-18 03:00:00');

        $cup = $this->cup($this->ana);

        $this->assertCount(11, $cup);
        $this->assertSame(range(1, 10), array_slice(array_column($cup, 'rank'), 0, 10));
        $this->assertSame(['rank' => 12, 'me' => true], ['rank' => $cup[10]['rank'], 'me' => $cup[10]['me']]);
    }
}
