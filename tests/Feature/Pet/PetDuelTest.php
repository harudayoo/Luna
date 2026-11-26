<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Inertia\Inertia;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Moon duels (spec 2026-11-25-luna-pet-social, slice 3): rock-paper-scissors between two pets on the board. Moon
 * outshines Star, Star outlasts Comet, Comet eclipses Moon. The challenger's pick stays hidden until the answer; no XP
 * moves. "Now" is Thu 2026-11-19 10:00 Manila (02:00 UTC).
 */
class PetDuelTest extends TestCase
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

    private function challenge(User $from, User $to, string $pick = 'moon'): TestResponse
    {
        return $this->actingAs($from)->post(route('pet.duels.store'), ['opponent_id' => $to->id, 'pick' => $pick]);
    }

    private function answer(User $as, PetDuel $duel, string $pick): TestResponse
    {
        return $this->actingAs($as)->post(route('pet.duels.answer', $duel), ['pick' => $pick]);
    }

    /** @return list<string> */
    private function kinds(User $user): array
    {
        return $user->fresh()->notifications()->get()->map(fn ($n) => $n->data['kind'])->values()->all();
    }

    public function test_a_challenge_needs_both_on_the_board_and_a_valid_pick()
    {
        $cy = $this->onBoard('Cy Lim', public: false);

        $this->challenge($this->ana, $cy)->assertSessionHasErrors('opponent_id');
        $this->challenge($cy, $this->ana)->assertSessionHasErrors('opponent_id');
        $this->challenge($this->ana, $this->ana)->assertSessionHasErrors('opponent_id');
        $this->challenge($this->ana, $this->ben, 'sun')->assertSessionHasErrors('pick');
        $this->assertSame(0, PetDuel::query()->count());

        $this->challenge($this->ana, $this->ben, 'star')->assertSessionHasNoErrors();
        $duel = PetDuel::query()->sole();
        $this->assertSame([$this->ana->id, $this->ben->id, 'star', 'open'],
            [$duel->challenger_id, $duel->opponent_id, $duel->challenger_pick, $duel->status]);
    }

    public function test_one_open_duel_per_pair_and_at_most_three_sent()
    {
        $this->challenge($this->ana, $this->ben)->assertSessionHasNoErrors();
        $this->challenge($this->ana, $this->ben)->assertSessionHasErrors('opponent_id');
        $this->challenge($this->ben, $this->ana)->assertSessionHasErrors('opponent_id');

        $this->challenge($this->ana, $this->onBoard('Cy Lim'))->assertSessionHasNoErrors();
        $this->challenge($this->ana, $this->onBoard('Dee Tan'))->assertSessionHasNoErrors();
        $this->challenge($this->ana, $this->onBoard('Eve Go'))->assertSessionHasErrors('opponent_id');
        $this->assertSame(3, PetDuel::query()->where('challenger_id', $this->ana->id)->count());
    }

    public function test_the_opponent_never_sees_the_challengers_pick_before_answering()
    {
        $this->challenge($this->ana, $this->ben, 'comet');

        $this->actingAs($this->ben)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_duels')
                ->reloadOnly('pet_duels', fn (AssertableInertia $reload) => $reload
                    ->has('pet_duels.incoming', 1)
                    ->has('pet_duels.incoming.0', fn (AssertableInertia $row) => $row
                        ->where('from', 'Ana')
                        ->where('from_id', $this->ana->id)
                        ->hasAll(['id', 'from_pet', 'kind', 'palette', 'wear', 'dyes', 'stage', 'at'])
                        ->missing('pick'))));

        $props = json_encode($this->actingAs($this->ben)
            ->get(route('dashboard'), ['X-Inertia' => 'true', 'X-Inertia-Partial-Component' => 'dashboard', 'X-Inertia-Partial-Data' => 'pet_duels', 'X-Inertia-Version' => Inertia::getVersion()])
            ->json());
        $this->assertStringNotContainsString('comet', $props);
    }

    public function test_every_pick_pair_gives_the_right_result_and_only_house_xp_is_written()
    {
        $beats = ['moon' => 'star', 'star' => 'comet', 'comet' => 'moon'];

        foreach (['moon', 'star', 'comet'] as $mine) {
            foreach (['moon', 'star', 'comet'] as $theirs) {
                $this->challenge($this->ana, $this->ben, $mine)->assertSessionHasNoErrors();
                $duel = PetDuel::query()->where('status', 'open')->sole();
                $this->answer($this->ben, $duel, $theirs)->assertSessionHasNoErrors();
                $duel->refresh();

                $expected = $mine === $theirs ? null : ($beats[$mine] === $theirs ? $this->ana->id : $this->ben->id);
                $this->assertSame(['done', $theirs, $expected], [$duel->status, $duel->opponent_pick, $duel->winner_id], "{$mine} vs {$theirs}");
                $this->assertNotNull($duel->answered_at);
            }
        }

        // Slice 4: the house pays duel XP (PetDuelStakesTest); nothing else is written, and nothing is taken.
        // (0-XP unlock rows are allowed: finishing a duel completes the "First duel" quest, slice 12.)
        $this->assertSame(0, PetEvent::query()->whereNotIn('kind', ['duel', 'unlock'])->orWhere('xp', '<', 0)->count());
    }

    public function test_only_the_opponent_answers_or_declines_and_only_once()
    {
        $this->challenge($this->ana, $this->ben);
        $duel = PetDuel::query()->sole();

        $this->answer($this->ana, $duel, 'star')->assertForbidden();
        $this->answer($this->onBoard('Cy Lim'), $duel, 'star')->assertForbidden();

        $this->answer($this->ben, $duel, 'star')->assertSessionHasNoErrors();
        $this->answer($this->ben, $duel, 'comet')->assertSessionHasErrors('duel');
        $this->actingAs($this->ben)->post(route('pet.duels.decline', $duel))->assertSessionHasErrors('duel');
        $this->assertSame('star', $duel->fresh()->opponent_pick);
    }

    public function test_declining_closes_the_duel_and_tells_the_challenger()
    {
        $this->challenge($this->ana, $this->ben);
        $duel = PetDuel::query()->sole();

        $this->actingAs($this->ben)->post(route('pet.duels.decline', $duel))->assertSessionHasNoErrors();

        $this->assertSame('declined', $duel->fresh()->status);
        $this->assertSame(['pet_duel_declined'], $this->kinds($this->ana));
        $this->answer($this->ben, $duel, 'moon')->assertSessionHasErrors('duel');
    }

    public function test_the_bell_tells_the_opponent_then_the_challenger_but_never_someone_deactivated()
    {
        $this->challenge($this->ana, $this->ben);
        $this->assertSame(['pet_duel'], $this->kinds($this->ben));
        $notice = $this->ben->fresh()->notifications()->first();
        $this->assertSame('home', $notice->data['module']);
        $this->assertSame(route('dashboard', ['pet' => 'duels'], false), $notice->data['url']);

        $this->answer($this->ben, PetDuel::query()->sole(), 'star');
        // Ana's first finished duel also completes her "First duel" quest (slice 12), and her first win unlocks the
        // wand (slice 13), each with its own notice.
        $this->assertSame(['pet_unlock', 'pet_quest', 'pet_duel_result'], $this->kinds($this->ana));

        $cy = $this->onBoard('Cy Lim');
        $this->challenge($cy, $this->ben);
        $cy->forceFill(['deactivated_at' => now()])->save();
        $this->answer($this->ben, PetDuel::query()->where('challenger_id', $cy->id)->sole(), 'star')->assertSessionHasNoErrors();
        $this->assertSame([], $this->kinds($cy));
    }

    public function test_an_open_duel_older_than_seven_days_expires_and_cannot_be_answered()
    {
        $this->challenge($this->ana, $this->ben);
        $duel = PetDuel::query()->sole();

        $this->travelTo('2026-11-26 02:00:01');
        $this->answer($this->ben, $duel, 'star')->assertSessionHasErrors('duel');
        $this->assertSame('expired', $duel->fresh()->status);

        // An expired duel no longer blocks the pair.
        $this->challenge($this->ana, $this->ben)->assertSessionHasNoErrors();
    }

    public function test_the_duels_tab_lists_incoming_sent_results_and_the_tally()
    {
        $cy = $this->onBoard('Cy Lim');
        $this->challenge($this->ana, $this->ben, 'moon');
        $this->answer($this->ben, PetDuel::query()->sole(), 'star');       // Ana wins
        $this->challenge($cy, $this->ana, 'comet');
        $this->answer($this->ana, PetDuel::query()->where('challenger_id', $cy->id)->sole(), 'moon'); // Comet eclipses Moon: Ana loses
        $this->challenge($this->ana, $this->ben, 'star');                   // sent, open
        $this->challenge($cy, $this->ana, 'moon');                          // incoming, open

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_duels', fn (AssertableInertia $reload) => $reload
                ->has('pet_duels.incoming', 1)
                ->where('pet_duels.incoming.0.from', 'Cy')
                ->has('pet_duels.sent', 1)
                ->where('pet_duels.sent.0.to', 'Ben')
                ->where('pet_duels.sent.0.to_id', $this->ben->id)
                ->where('pet_duels.sent.0.pick', 'star')
                ->has('pet_duels.results', 2)
                ->where('pet_duels.results.0.against', 'Cy')
                ->where('pet_duels.results.0.mine', 'moon')
                ->where('pet_duels.results.0.theirs', 'comet')
                ->where('pet_duels.results.0.outcome', 'loss')
                ->where('pet_duels.results.1.outcome', 'win')
                ->where('pet_duels.tally', ['win' => 1, 'loss' => 1, 'draw' => 0])
                ->where('pet_duels.open_sent_max', 3)));
    }

    public function test_board_rows_carry_the_person_so_they_can_be_challenged()
    {
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                ->where('pet_board.rows.0.user_id', $this->ana->id)
                ->where('pet_board.rows.1.user_id', $this->ben->id)));
    }

    public function test_the_migration_goes_up_and_down()
    {
        $migration = require database_path('migrations/2026_11_25_000028_create_pet_duels_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasTable('pet_duels'));
        $migration->up();
        $this->assertTrue(Schema::hasTable('pet_duels'));
    }
}
