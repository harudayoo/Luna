<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\Payslip;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Payroll\PayslipMath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The pet up close (spec 2026-11-25-luna-pet-social, slice 1): a name, and the panel's details (this week, recent XP,
 * what gives XP), loaded only when the panel opens. "Now" is Thu 2026-11-19 10:00 Manila (02:00 UTC).
 */
class PetPanelTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create();
    }

    public function test_a_person_names_their_pet_and_can_clear_the_name()
    {
        // Since slice 6 (spec 2026-11-25-luna-moonling-life) the name belongs to the active moonling.
        $name = fn () => Moonlings::active($this->ana)->fresh()->name;

        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => '  Mochi  '])->assertSessionHasNoErrors();
        $this->assertSame('Mochi', $name());

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('pet.name', 'Mochi'));

        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => str_repeat('a', 21)])->assertSessionHasErrors('name');
        $this->assertSame('Mochi', $name());

        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => ''])->assertSessionHasNoErrors();
        $this->assertNull($name());
    }

    public function test_guests_cannot_name_a_pet()
    {
        $this->patch(route('pet.update'), ['name' => 'Mochi'])->assertRedirect(route('login'));
    }

    public function test_the_details_load_only_when_the_panel_asks_for_them()
    {
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_detail')
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    ->where('pet_detail.xp.visit', 5)
                    ->where('pet_detail.xp.item_time', 10)
                    ->where('pet_detail.xp.leave', 5)
                    ->where('pet_detail.xp.payslip', 5)
                    ->where('pet_detail.streak_bonus_max', 5)));
    }

    public function test_the_week_shows_each_office_day_as_visited_missed_skipped_or_to_come()
    {
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-17']);
        Holiday::query()->create(['date' => '2026-11-18', 'name' => 'Holiday', 'kind' => 'special']);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                ->where('pet_detail.week', [
                    ['date' => '2026-11-16', 'day' => 'Mon', 'status' => 'missed'],
                    ['date' => '2026-11-17', 'day' => 'Tue', 'status' => 'skipped'],
                    ['date' => '2026-11-18', 'day' => 'Wed', 'status' => 'skipped'],
                    ['date' => '2026-11-19', 'day' => 'Thu', 'status' => 'visited'],
                    ['date' => '2026-11-20', 'day' => 'Fri', 'status' => 'upcoming'],
                ])));
    }

    public function test_recent_xp_lists_the_last_ten_awards_newest_first_with_readable_labels()
    {
        for ($d = 1; $d <= 8; $d++) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => "2026-10-0{$d}", 'xp' => 5])
                ->forceFill(['created_at' => "2026-10-0{$d} 02:00:00"])->save();
        }

        $this->actingAs($this->ana)->get(route('dashboard')); // visit, 02:00
        $this->travelTo('2026-11-19 02:10:00');
        $item = $this->ana->items()->create(['scope' => 'personal', 'title' => 'Quote Proposal', 'status' => 'queue']);
        $this->actingAs($this->ana)->post(route('items.times.store', $item), ['date' => '2026-11-19', 'start' => '08:00', 'end' => '09:00']);
        $this->travelTo('2026-11-19 02:20:00');
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-12-03'])->assertSessionHasNoErrors();
        $this->travelTo('2026-11-19 02:30:00');
        $inputs = array_fill_keys(Payslip::INPUTS, 0);
        $slip = Payslip::create($inputs + PayslipMath::totals(60000, 2727.27, $inputs) + [
            'user_id' => $this->ana->id, 'period_start' => '2026-11-01', 'period_end' => '2026-11-15', 'issued_on' => '2026-11-15',
            'position' => 'Developer', 'monthly_salary' => 60000, 'daily_rate' => 2727.27, 'released_on' => '2026-11-15',
        ]);
        $this->actingAs($this->ana)->get(route('payslips.print', $slip))->assertOk();

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                ->has('pet_detail.recent', 10)
                ->where('pet_detail.recent.0.label', 'Opened your payslip for Nov 1–15')
                ->where('pet_detail.recent.0.xp', 5)
                ->where('pet_detail.recent.1.label', 'Filed leave for Dec 3')
                ->where('pet_detail.recent.2.label', 'Logged time on Quote Proposal')
                ->where('pet_detail.recent.2.xp', 10)
                ->where('pet_detail.recent.3.label', 'Daily visit')
                ->where('pet_detail.recent.4.at', '2026-10-08')));
    }

    public function test_the_migration_goes_up_and_down()
    {
        // `pet_name` was dropped by 000031: bring it back first, so this older migration finds what it made.
        (require database_path('migrations/2026_11_26_000031_drop_pet_name_from_users_table.php'))->down();
        $migration = require database_path('migrations/2026_11_25_000027_add_pet_fields_to_users_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasColumns('users', ['pet_name', 'pet_public']));
        $migration->up();
        $this->assertTrue(Schema::hasColumns('users', ['pet_name', 'pet_public']));
    }
}
