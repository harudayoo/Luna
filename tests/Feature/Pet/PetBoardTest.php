<?php

namespace Tests\Feature\Pet;

use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The office board (spec 2026-11-25-luna-pet-social, slice 2): opt-in, active people only, ranked by stage, then
 * streak, then name; top 10 plus your own row; no XP for anyone. "Now" is Thu 2026-11-19 10:00 Manila (02:00 UTC).
 */
class PetBoardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
    }

    /** A person on the board with this much XP and visits on these office dates. */
    private function pet(string $name, int $xp = 0, array $visits = [], bool $public = true): User
    {
        $user = User::factory()->create(['name' => $name]);
        $user->forceFill(['pet_public' => $public])->save();
        if ($xp > 0) {
            PetEvent::query()->create(['user_id' => $user->id, 'kind' => 'seed', 'ref' => 'seed', 'xp' => $xp]);
        }
        foreach ($visits as $date) {
            PetEvent::query()->create(['user_id' => $user->id, 'kind' => 'visit', 'ref' => $date, 'xp' => 0]);
        }

        return $user;
    }

    public function test_people_join_and_leave_the_board_without_touching_the_name()
    {
        $ana = User::factory()->create();
        // Since slice 6 (spec 2026-11-25-luna-moonling-life) the name belongs to the active moonling.
        Moonlings::active($ana)->update(['name' => 'Mochi']);
        $name = fn () => Moonlings::active($ana)->fresh()->name;

        $this->actingAs($ana)->patch(route('pet.update'), ['public' => true])->assertSessionHasNoErrors();
        $this->assertTrue($ana->fresh()->pet_public);
        $this->assertSame('Mochi', $name());

        $this->actingAs($ana)->get(route('dashboard'))->assertInertia(fn ($page) => $page->where('pet.public', true));

        $this->actingAs($ana)->patch(route('pet.update'), ['public' => false])->assertSessionHasNoErrors();
        $this->assertFalse($ana->fresh()->pet_public);
        $this->assertSame('Mochi', $name());
    }

    public function test_only_active_people_who_joined_are_on_the_board()
    {
        $ana = $this->pet('Ana Cruz');
        $this->pet('Ben Reyes');
        $this->pet('Cy Lim', public: false);
        $this->pet('Dee Tan')->forceFill(['deactivated_at' => now()])->save();
        $this->pet('Eve Go')->forceFill(['password' => null])->save();

        $board = Pet::board($ana);

        $this->assertTrue($board['joined']);
        $this->assertSame(['Ana', 'Ben'], array_column($board['rows'], 'first_name'));
    }

    public function test_the_board_ranks_by_stage_then_streak_then_name_with_no_xp()
    {
        $me = $this->pet('Zed Uy', 0);
        $this->pet('Ana Cruz', 400);                                                   // Bright, no streak
        $this->pet('Ben Reyes', 150, ['2026-11-17', '2026-11-18', '2026-11-19']);      // Moonling, 3
        $this->pet('Cy Lim', 160, ['2026-11-19']);                                     // Moonling, 1
        $this->pet('Bo Ong', 150, ['2026-11-19']);                                     // Moonling, 1

        $rows = Pet::board($me)['rows'];

        $this->assertSame(['Ana', 'Ben', 'Bo', 'Cy', 'Zed'], array_column($rows, 'first_name'));
        $this->assertSame([1, 2, 3, 4, 5], array_column($rows, 'rank'));
        $this->assertSame([3, 2, 2, 2, 0], array_column($rows, 'stage'));
        $this->assertSame([0, 3, 1, 1, 0], array_column($rows, 'streak'));
        $this->assertSame('Bright', $rows[0]['stage_name']);
        $this->assertTrue($rows[4]['me']);
        foreach ($rows as $row) {
            $this->assertArrayNotHasKey('xp', $row);
        }
    }

    public function test_it_shows_the_top_ten_and_your_own_row_under_them()
    {
        foreach (range(1, 11) as $i) {
            $this->pet(sprintf('P%02d Person', $i), 900);
        }
        $me = $this->pet('Zed Uy', 0);

        $rows = Pet::board($me)['rows'];

        $this->assertCount(11, $rows);
        $this->assertSame('P10', $rows[9]['first_name']);
        $this->assertSame(['Zed', 12, true], [$rows[10]['first_name'], $rows[10]['rank'], $rows[10]['me']]);
    }

    public function test_someone_not_on_the_board_still_sees_it_without_a_row_of_their_own()
    {
        $this->pet('Ana Cruz', 40);
        $me = $this->pet('Zed Uy', 900, public: false);

        $board = Pet::board($me);

        $this->assertFalse($board['joined']);
        $this->assertSame(['Ana'], array_column($board['rows'], 'first_name'));
    }

    public function test_the_board_costs_the_same_queries_for_three_people_or_twelve()
    {
        $count = function (User $me): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            Pet::board($me);
            $n = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $n;
        };

        $me = $this->pet('Ana Cruz', 40, ['2026-11-19']);
        $this->pet('Ben Reyes', 40, ['2026-11-19']);
        $this->pet('Cy Lim', 40, ['2026-11-19']);
        $few = $count($me);

        foreach (range(1, 9) as $i) {
            $this->pet("P{$i} Person", 40, ['2026-11-18', '2026-11-19']);
        }

        $this->assertSame($few, $count($me));
    }

    public function test_the_board_loads_only_when_its_tab_asks_for_it()
    {
        $me = $this->pet('Ana Cruz', 40);

        $this->actingAs($me)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_board')
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.joined', true)
                    ->where('pet_board.rows.0.first_name', 'Ana')));
    }
}
