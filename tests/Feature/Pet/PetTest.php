<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\Item;
use App\Models\Leave;
use App\Models\Payslip;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Everyone's pet grows from a daily visit (with a streak bonus), item time, leave and their own released payslips
 * (spec 2026-11-24-luna-pet). Dates are office dates (Manila); "now" starts at Thu 2026-11-19 10:00 Manila (02:00 UTC).
 */
class PetTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create();
    }

    private function visit(string $utc): TestResponse
    {
        $this->travelTo($utc);

        return $this->actingAs($this->ana)->get(route('dashboard'))->assertOk();
    }

    private function xp(User $user, ?string $kind = null): int
    {
        return (int) PetEvent::query()->where('user_id', $user->id)->when($kind, fn ($q) => $q->where('kind', $kind))->sum('xp');
    }

    private function giveXp(User $user, int $xp): void
    {
        PetEvent::query()->create(['user_id' => $user->id, 'kind' => 'seed', 'ref' => 'seed', 'xp' => $xp]);
    }

    private function item(): Item
    {
        return $this->ana->items()->create(['scope' => 'personal', 'title' => 'Item', 'status' => 'queue']);
    }

    private function slip(User $user, ?string $released): Payslip
    {
        $inputs = array_fill_keys(Payslip::INPUTS, 0);

        return Payslip::create($inputs + PayslipMath::totals(60000, 2727.27, $inputs) + [
            'user_id' => $user->id, 'period_start' => '2026-10-01', 'period_end' => '2026-10-31', 'issued_on' => '2026-10-31',
            'position' => 'Developer', 'monthly_salary' => 60000, 'daily_rate' => 2727.27, 'released_on' => $released,
        ]);
    }

    public function test_the_first_dashboard_load_of_the_day_feeds_the_pet_once()
    {
        $this->visit('2026-11-19 02:00:00')
            ->assertInertia(fn ($page) => $page->where('pet.xp', 5)->where('pet.stage', 0)->where('pet.stage_name', 'Egg')
                ->where('pet.next_at', 40)->where('pet.streak', 1)->where('pet.fed_today', true)->where('pet_moment', 'fed'));

        $this->visit('2026-11-19 05:00:00')
            ->assertInertia(fn ($page) => $page->where('pet.xp', 5)->where('pet_moment', null));
    }

    public function test_the_day_is_the_office_day_not_the_utc_day()
    {
        // 23:30 UTC on the 18th is 07:30 on the 19th in Manila.
        $this->visit('2026-11-18 23:30:00');

        $this->assertSame('2026-11-19', PetEvent::query()->where('kind', 'visit')->sole()->ref);
    }

    public function test_the_streak_skips_weekends_holidays_and_own_leave_but_breaks_on_a_missed_office_day()
    {
        Holiday::query()->create(['date' => '2026-11-18', 'name' => 'Holiday', 'kind' => 'special']);
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-20']);

        $this->visit('2026-11-16 02:00:00'); // Mon: 5
        $this->visit('2026-11-17 02:00:00'); // Tue: 5 + 1
        $this->visit('2026-11-19 02:00:00') // Thu, after Wed's holiday: 5 + 2
            ->assertInertia(fn ($page) => $page->where('pet.streak', 3));
        $this->assertSame(18, $this->xp($this->ana));

        // Fri on leave, then the weekend: Monday carries on.
        $this->visit('2026-11-23 02:00:00')->assertInertia(fn ($page) => $page->where('pet.streak', 4));
        $this->assertSame(18 + 8, $this->xp($this->ana));

        // Tuesday missed: Wednesday starts over.
        $this->visit('2026-11-25 02:00:00')->assertInertia(fn ($page) => $page->where('pet.streak', 1));
        $this->assertSame(26 + 5, $this->xp($this->ana));
    }

    public function test_the_streak_bonus_stops_at_five()
    {
        foreach (['16', '17', '18', '19', '20', '23', '24', '25'] as $day) {
            $this->visit("2026-11-{$day} 02:00:00");
        }

        // 5, 6, 7, 8, 9, 10, 10, 10 (visit XP only: four visits in a week also pay a weekly quest, slice 18)
        $this->assertSame(65, $this->xp($this->ana, 'visit'));
    }

    public function test_logging_item_time_feeds_the_pet_once_per_item_per_office_day()
    {
        $first = $this->item();
        $second = $this->item();

        $this->actingAs($this->ana)->post(route('items.start', $first));
        $this->travelTo('2026-11-19 02:30:00');
        $this->actingAs($this->ana)->post(route('items.stop'));
        $this->actingAs($this->ana)->post(route('items.start', $first));
        $this->travelTo('2026-11-19 02:45:00');
        $this->actingAs($this->ana)->post(route('items.stop'));
        $this->assertSame(10, $this->xp($this->ana, 'item_time'));

        $this->actingAs($this->ana)->post(route('items.times.store', $second), ['date' => '2026-11-19', 'start' => '08:00', 'end' => '09:00'])
            ->assertSessionHasNoErrors();
        $this->assertSame(20, $this->xp($this->ana, 'item_time'));

        $this->travelTo('2026-11-20 02:00:00');
        $this->actingAs($this->ana)->post(route('items.times.store', $first), ['date' => '2026-11-20', 'start' => '08:00', 'end' => '09:00'])
            ->assertSessionHasNoErrors();
        $this->assertSame(30, $this->xp($this->ana, 'item_time'));
    }

    public function test_filing_leave_feeds_the_pet()
    {
        $this->actingAs($this->ana)->post(route('leave.store'), ['from' => '2026-11-26'])->assertSessionHasNoErrors();

        $this->assertSame(5, $this->xp($this->ana, 'leave'));
    }

    public function test_opening_ones_own_released_payslip_feeds_the_pet_once_and_hr_viewing_feeds_nobody()
    {
        $released = $this->slip($this->ana, '2026-10-31');

        $this->actingAs($this->ana)->get(route('payslips.print', $released))->assertOk();
        $this->actingAs($this->ana)->get(route('payslips.print', $released))->assertOk();
        $this->assertSame(5, $this->xp($this->ana, 'payslip'));

        $hr = User::factory()->hr()->create();
        $other = $this->slip(User::factory()->create(), '2026-10-31');
        $draft = $this->slip($hr, null);
        $this->actingAs($hr)->get(route('payslips.print', $other))->assertOk();
        $this->actingAs($hr)->get(route('payslips.print', $draft))->assertOk();

        $this->assertSame(0, PetEvent::query()->where('kind', 'payslip')->where('user_id', '!=', $this->ana->id)->count());
    }

    public function test_the_stage_and_next_threshold_at_each_boundary()
    {
        $cases = [0 => [0, 40], 39 => [0, 40], 40 => [1, 150], 149 => [1, 150], 150 => [2, 400], 399 => [2, 400],
            400 => [3, 900], 899 => [3, 900], 900 => [4, null], 2000 => [4, null]];

        foreach ($cases as $xp => [$stage, $next]) {
            $user = User::factory()->create();
            if ($xp > 0) {
                $this->giveXp($user, $xp);
            }
            $state = Pet::state($user);
            $this->assertSame([$xp, $stage, $next], [$state['xp'], $state['stage'], $state['next_at']], "at {$xp} XP");
        }
        $this->assertSame(['Egg', 'Hatchling', 'Moonling', 'Bright', 'Full Moon'], Pet::STAGE_NAMES);
    }

    public function test_growing_shows_once_on_the_next_dashboard_load_even_when_earned_elsewhere()
    {
        $this->giveXp($this->ana, 30);
        $this->visit('2026-11-19 02:00:00')->assertInertia(fn ($page) => $page->where('pet.xp', 35)->where('pet_moment', 'fed'));

        // Item time crosses 40 on the Items page.
        $this->actingAs($this->ana)->post(route('items.times.store', $this->item()), ['date' => '2026-11-19', 'start' => '08:00', 'end' => '09:00']);

        $this->visit('2026-11-19 03:00:00')->assertInertia(fn ($page) => $page->where('pet.stage', 1)->where('pet_moment', 'grew'));
        $this->visit('2026-11-19 03:05:00')->assertInertia(fn ($page) => $page->where('pet_moment', null));
    }

    public function test_hr_and_admin_have_a_pet_too()
    {
        $this->actingAs(User::factory()->admin()->create())->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('pet.xp', 5)->where('pet.stage_name', 'Egg'));
    }

    public function test_the_migration_goes_up_and_down()
    {
        $migration = require database_path('migrations/2026_11_24_000026_create_pet_events_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasTable('pet_events'));
        $migration->up();
        $this->assertTrue(Schema::hasTable('pet_events'));
    }
}
