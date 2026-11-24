<?php

namespace Tests\Feature\Payroll;

use App\Models\Leave;
use App\Models\Setting;
use App\Models\User;
use App\Services\Payroll\PayRate;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The rate matches the accountant's audit workbook "PAYROLL & PTO TRACKER" (Aug-Dec 2026; user, 2026-11-24):
 * an hour costs monthly x 12 / 2080 (a day is monthly x 12 / 260) in every month, and the unpaid and late
 * deductions are both charged at it. A fixed daily rate HR sets for a person still wins.
 */
class AuditRateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-24 09:00:00');
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

    public function test_an_hour_is_monthly_times_12_over_2080_in_every_month()
    {
        $harold = $this->employee(60000);
        $policy = Policy::current();

        $this->assertSame(2769.23, PayRate::dailyFor($harold, $this->on('2026-09-25')));
        $this->assertSame(2769.23, PayRate::dailyFor($harold, $this->on('2026-11-03')));
        $this->assertSame(2076.92, PayRate::forHours($harold, 6, $policy, $this->on('2026-09-25')));   // audit, Aug-Sep tab
        $this->assertSame(2076.92, PayRate::forHours($harold, 6, $policy, $this->on('2026-11-03')));   // audit, Nov 1-15 tab
        $this->assertSame(311.54, PayRate::forHours($harold, 54 / 60, $policy, $this->on('2026-10-09')));   // 54 late minutes
        $this->assertSame(1384.62, PayRate::forHours($this->employee(40000), 6, $policy, $this->on('2026-09-15')));   // Dave
        $this->assertSame(201.92, PayRate::forHours($this->employee(35000), 1, $policy, $this->on('2026-12-01')));
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

    public function test_the_monthly_payslips_match_the_audit()
    {
        config(['luna.pay.frequency' => 'monthly']);
        Setting::put('pto.accrual_mode', 'full');
        $user = $this->employee(60000);
        // Audit: 10.00 h by Sep 30, Sep 25+28 leaves 6 h unpaid; 10.00 h again by Nov 1-15, Nov 3+4 leaves 6 h unpaid.
        foreach (['2026-09-25', '2026-09-28', '2026-11-03', '2026-11-04'] as $date) {
            Leave::factory()->for($user)->create(['date' => $date]);
        }
        $hr = User::factory()->hr()->create();

        $this->actingAs($hr)
            ->get(route('people.payroll.edit', [$user, '2026-09-01']))
            ->assertInertia(fn ($page) => $page
                ->where('person.daily_rate', 2769.23)
                ->where('payslip.unpaid_hours', 6)
                ->where('payslip.absences', 2076.92));

        $this->actingAs($hr)
            ->get(route('people.payroll.edit', [$user, '2026-11-01']))
            ->assertInertia(fn ($page) => $page
                ->where('payslip.unpaid_hours', 6)
                ->where('payslip.absences', 2076.92));
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
