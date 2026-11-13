<?php

namespace Tests\Feature\Payroll;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use App\Services\Payroll\PayRate;
use App\Services\Payroll\WorkDays;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The daily rate follows the month (user, 2026-11-13): monthly salary ÷ that month's working days
 * (every Mon-Fri; holidays still count, as they are paid days: user, 2026-11-13), unless HR pins a fixed
 * daily rate for the person. The 2026 holidays are seeded by migration, so Aug and Nov have weekday holidays.
 */
class MonthlyWorkDaysRateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-13 09:00:00');
    }

    private function employee(float $monthly, ?float $fixed = null): User
    {
        $user = User::factory()->create();
        $user->forceFill(['monthly_salary' => $monthly, 'fixed_daily_rate' => $fixed])->save();

        return $user;
    }

    private function on(string $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date);
    }

    public function test_working_days_are_every_weekday_in_the_month()
    {
        $this->assertSame(21, WorkDays::inMonth($this->on('2026-08-10')));   // Aug 21 and Aug 31 still count
        $this->assertSame(22, WorkDays::inMonth($this->on('2026-09-25')));
        $this->assertSame(22, WorkDays::inMonth($this->on('2026-10-01')));
        $this->assertSame(21, WorkDays::inMonth($this->on('2026-11-30')));   // Nov 2 and Nov 30 still count
    }

    public function test_a_weekday_holiday_is_a_paid_working_day()
    {
        Holiday::query()->create(['date' => '2026-10-15', 'name' => 'A Thursday', 'kind' => 'regular']);

        $this->assertSame(22, WorkDays::inMonth($this->on('2026-10-15')));
    }

    public function test_the_rate_follows_the_months_working_days()
    {
        $harold = $this->employee(60000);
        $policy = Policy::current();

        $this->assertSame(2727.27, PayRate::dailyFor($harold, $this->on('2026-09-25')));
        $this->assertSame(2045.45, PayRate::forHours($harold, 6, $policy, $this->on('2026-09-25')));
        $this->assertSame(340.91, PayRate::forHours($harold, 1, $policy, $this->on('2026-10-09')));
        $this->assertSame(2142.86, PayRate::forHours($harold, 6, $policy, $this->on('2026-11-03')));   // 60,000 / 21 / 8 x 6
    }

    public function test_a_fixed_daily_rate_wins_in_every_month()
    {
        $user = $this->employee(60000, 3000);
        $policy = Policy::current();

        $this->assertSame(2250.0, PayRate::forHours($user, 6, $policy, $this->on('2026-09-25')));
        $this->assertSame(2250.0, PayRate::forHours($user, 6, $policy, $this->on('2026-11-03')));
    }

    public function test_a_person_with_only_a_legacy_daily_rate_is_still_charged_from_it()
    {
        $user = User::factory()->create(['daily_rate' => 1600]);

        $this->assertSame(1200.0, PayRate::forHours($user, 6, Policy::current(), $this->on('2026-09-25')));
        $this->assertTrue(PayRate::hasRate($user));
        $this->assertFalse(PayRate::hasRate(User::factory()->create()));
        $this->assertNull(PayRate::forHours(User::factory()->create(), 6, Policy::current(), $this->on('2026-09-25')));
    }

    public function test_hr_sets_and_clears_a_fixed_daily_rate()
    {
        $hr = User::factory()->hr()->create();
        $user = $this->employee(60000);

        $this->actingAs($hr)
            ->patch(route('people.update', $user), ['monthly_salary' => 60000, 'fixed_daily_rate' => 2800, 'pto_opening_hours' => 0])
            ->assertSessionHasNoErrors();
        $this->assertSame('2800.00', $user->fresh()->fixed_daily_rate);

        $this->actingAs($hr)
            ->patch(route('people.update', $user), ['monthly_salary' => 60000, 'fixed_daily_rate' => '', 'pto_opening_hours' => 0])
            ->assertSessionHasNoErrors();
        $this->assertNull($user->fresh()->fixed_daily_rate);
    }

    public function test_the_payslip_charges_at_its_months_rate()
    {
        config(['luna.pay.frequency' => 'monthly']);
        $user = $this->employee(60000);
        // Full accrual: 10.00 h by Sep 30, 16 h taken, 6 h unpaid.
        \App\Models\Setting::put('pto.accrual_mode', 'full');
        Leave::factory()->for($user)->create(['date' => '2026-09-25']);
        Leave::factory()->for($user)->create(['date' => '2026-09-28']);

        $this->actingAs(User::factory()->hr()->create())
            ->get(route('people.payroll.edit', [$user, '2026-09-01']))
            ->assertInertia(fn ($page) => $page
                ->where('person.daily_rate', 2727.27)
                ->where('payslip.unpaid_hours', 6)
                ->where('payslip.absences', 2045.45));
    }

    public function test_the_migration_adds_and_drops_the_column()
    {
        $migration = require database_path('migrations/2026_11_13_000019_add_fixed_daily_rate_to_users_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'fixed_daily_rate'));
        $migration->up();
        $this->assertTrue(Schema::hasColumn('users', 'fixed_daily_rate'));
    }
}
