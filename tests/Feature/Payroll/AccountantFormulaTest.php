<?php

namespace Tests\Feature\Payroll;

use App\Models\Leave;
use App\Models\Setting;
use App\Models\User;
use App\Services\Payroll\PayRate;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The accountant's formula, from the Sep and Oct 2026 payroll summaries and the Aug-Dec PTO computation:
 * - an hour costs monthly x 12 / 260 days / 8 h (monthly / 173.33);
 * - PTO earns exactly 10/3 h per cut-off, from the cut-off someone joins in (Aug 16-31 for Aug 18);
 * - any leave in a cut-off forfeits that cut-off's 10/3 h (accountant, 2026-11-12: PTO on the 7th loses 1-15);
 * - a payslip deducts the unpaid hours of its own cut-off.
 */
class AccountantFormulaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // These payslips are per cut-off (half the salary each); the office default is monthly (PayFrequencyTest).
        config(['luna.pay.frequency' => 'semi_monthly']);
        $this->travelTo('2026-11-12 09:00:00');
    }

    private function employee(float $monthly): User
    {
        $user = User::factory()->create();
        $user->forceFill(['monthly_salary' => $monthly, 'daily_rate' => round($monthly / 22, 2)])->save();

        return $user;
    }

    public function test_pto_accrues_a_third_of_ten_hours_per_cut_off_from_august_16()
    {
        $rows = Ledger::build(Policy::current(), CarbonImmutable::parse('2026-08-18'), 0, [], CarbonImmutable::parse('2026-09-30'));

        $this->assertSame(['2026-08-16', 3.33], [$rows[0]->start->toDateString(), $rows[0]->balance]);
        $this->assertSame(6.67, $rows[1]->balance);
        $this->assertSame(10.0, $rows[2]->balance);
    }

    public function test_an_hour_costs_monthly_over_173_33()
    {
        $policy = Policy::current();

        $this->assertSame(260.0, $policy->workDaysPerYear);
        $this->assertSame(1384.62, PayRate::forHours($this->employee(40000), 6, $policy));
        $this->assertSame(2076.92, PayRate::forHours($this->employee(60000), 6, $policy));
    }

    public function test_a_person_with_only_a_daily_rate_is_charged_from_it()
    {
        $user = User::factory()->create(['daily_rate' => 1600]);

        $this->assertSame(1200.0, PayRate::forHours($user, 6, Policy::current()));
        $this->assertNull(PayRate::forHours(User::factory()->create(), 6, Policy::current()));
    }

    public function test_the_monthly_salary_sets_the_daily_rate_over_21_67_days()
    {
        $user = $this->employee(40000);

        $this->actingAs(User::factory()->hr()->create())
            ->patch(route('people.update', $user), ['monthly_salary' => 60000, 'pto_opening_hours' => 0])
            ->assertSessionHasNoErrors();

        $this->assertSame('2769.23', $user->fresh()->daily_rate);
    }

    public function test_leave_in_a_cut_off_forfeits_that_cut_offs_accrual()
    {
        // Dave: 40,000 a month, whole days on Sep 4 (Sep 1-15) and Sep 17 (Sep 16-30).
        $rows = Ledger::build(Policy::current(), CarbonImmutable::parse('2026-08-18'), 0, [
            ['date' => '2026-09-04', 'days' => 1], ['date' => '2026-09-17', 'days' => 1],
        ], CarbonImmutable::parse('2026-10-31'));

        $this->assertSame([3.33, 0.0, 0.0, 3.33], array_map(fn ($c) => $c->accrued, array_slice($rows, 0, 4)));
        $this->assertSame([0.0, 4.67, 8.0, 0.0], array_map(fn ($c) => $c->deductedHours, array_slice($rows, 0, 4)));

        // Pesos come from the exact hours (4.6667, not 4.67), rounded once at the end.
        $dave = $this->employee(40000);
        $this->assertSame(1076.92, PayRate::forHours($dave, $rows[1]->deductedHoursExact, Policy::current()));
        $this->assertSame(1846.15, PayRate::forHours($dave, $rows[2]->deductedHoursExact, Policy::current()));
    }

    public function test_leave_on_a_holiday_does_not_forfeit_the_accrual()
    {
        $rows = Ledger::build(Policy::current(), CarbonImmutable::parse('2026-08-18'), 0, [
            ['date' => '2026-09-04', 'days' => 1],
        ], CarbonImmutable::parse('2026-09-30'), ['2026-09-04']);

        $this->assertSame(3.33, $rows[1]->accrued);
    }

    public function test_leave_is_deducted_on_the_payslip_of_its_own_cut_off()
    {
        $user = $this->employee(60000);
        Leave::factory()->for($user)->create(['date' => '2026-09-25']);
        Leave::factory()->for($user)->create(['date' => '2026-09-28']);
        $hr = User::factory()->hr()->create();

        // 6.67 h carried in, nothing earned in Sep 16-30 (it has leave), 16 h taken: 9.33 h unpaid.
        $this->actingAs($hr)
            ->get(route('people.payroll.edit', [$user, '2026-09-16']))
            ->assertInertia(fn ($page) => $page
                ->where('payslip.unpaid_hours', 9.33)
                ->where('payslip.absences', 3230.77));

        $this->actingAs($hr)
            ->get(route('people.payroll.edit', [$user, '2026-10-01']))
            ->assertInertia(fn ($page) => $page->where('payslip.absences', 0));
    }

    public function test_the_migration_moves_stored_values_and_reverses()
    {
        $derived = $this->employee(60000);                       // 2727.27, from / 22
        $typed = $this->employee(60000);
        $typed->forceFill(['daily_rate' => 3000])->save();       // HR's own figure
        Setting::put('pto.accrual_hours', '3.33');
        $migration = require database_path('migrations/2026_11_12_000013_use_accountant_pay_basis.php');

        $migration->up();
        $this->assertSame(['2769.23', '3000.00'], [$derived->fresh()->daily_rate, $typed->fresh()->daily_rate]);
        $this->assertNull(Setting::get('pto.accrual_hours'));
        $this->assertEqualsWithDelta(10 / 3, Policy::current()->accrualHours, 1e-9);

        $migration->down();
        $this->assertSame(['2727.27', '3000.00'], [$derived->fresh()->daily_rate, $typed->fresh()->daily_rate]);
        $this->assertSame('3.33', Setting::get('pto.accrual_hours'));
    }

    public function test_hr_sets_the_working_days_a_year()
    {
        $this->actingAs(User::factory()->hr()->create())
            ->put(route('people.policy.update'), [
                'accrual_mode' => 'full', 'accrual_hours' => 3.3333, 'monthly_cap_days' => 10,
                'office_started_on' => '2026-08-18', 'work_days_per_year' => 261,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(261.0, Policy::current()->workDaysPerYear);
        $this->assertSame('3.3333', (string) Setting::get('pto.accrual_hours'));
    }
}
