<?php

namespace Tests\Feature\Payroll;

use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayFrequency;
use App\Services\Payroll\PaySchedule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A saved payslip keeps its own period, and per cut-off pay takes the monthly deductions once a month.
 * "Today" is Thu 2026-11-12. Ana earns 60,000 a month and has no leave.
 */
class PayslipPeriodTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-12 09:00:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-10-01', 'daily_rate' => 2769.23]);
        $this->ana->forceFill(['monthly_salary' => 60000, 'position' => 'Developer'])->save();
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'issued_on' => '2026-11-30', 'holiday_regular_days' => 0, 'holiday_special_days' => 0, 'absences' => 0,
            'overtime_allowance' => 0, 'sss' => 0, 'philhealth' => 0, 'pagibig' => 0, 'withholding_tax' => 0, 'cash_advance' => 0,
        ];
    }

    /** A per cut-off payslip saved before the office's monthly schedule covered its month. */
    private function oldCutOffPayslip(array $attributes = []): Payslip
    {
        return Payslip::query()->create($attributes + [
            'user_id' => $this->ana->id, 'period_start' => '2026-08-16', 'period_end' => '2026-08-31',
            'issued_on' => '2026-08-28', 'position' => 'Developer', 'monthly_salary' => 60000, 'daily_rate' => 2769.23,
            'basic_pay' => 30000, 'holiday_pay' => 0, 'absences' => 0, 'overtime_allowance' => 0, 'gross_pay' => 30000,
            'sss' => 0, 'philhealth' => 0, 'pagibig' => 0, 'withholding_tax' => 0, 'cash_advance' => 0,
            'total_deductions' => 0, 'net_pay' => 30000, 'unpaid_hours' => 0,
            'holiday_regular_days' => 0, 'holiday_special_days' => 0,
        ]);
    }

    public function test_a_saved_payslip_opens_in_its_own_period_after_the_schedule_changed()
    {
        $this->assertSame(PayFrequency::Monthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2026-08-16')));
        $this->oldCutOffPayslip(['released_on' => '2026-11-12']);

        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2026-08-16']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/payslip')
                ->where('period.start', '2026-08-16')
                ->where('period.end', '2026-08-31')
                ->where('frequency', 'semi_monthly')
                ->where('saved', true)
                ->where('payslip.basic_pay', 30000)
                ->where('released_on', '2026-11-12'));
    }

    public function test_an_unreleased_old_payslip_saves_in_its_own_period()
    {
        $this->oldCutOffPayslip();

        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-08-16']), $this->payload(['sss' => 500]))
            ->assertSessionHasNoErrors();

        $slip = Payslip::sole();
        $this->assertSame(['2026-08-31', '30000.00', '29500.00'], [$slip->period_end->toDateString(), $slip->basic_pay, $slip->net_pay]);
    }

    public function test_per_cut_off_takes_the_deductions_on_the_month_end_cut_off_only()
    {
        PaySchedule::change(PayFrequency::SemiMonthly, '2026-11');
        $deductions = ['sss' => 1350, 'philhealth' => 750, 'pagibig' => 200, 'withholding_tax' => 1000, 'cash_advance' => 500];

        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-16']), $this->payload($deductions))
            ->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-12-01']), $this->payload(['overtime_allowance' => 300]))
            ->assertSessionHasNoErrors();

        // The 1st-15th cut-off starts every deduction at 0.
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2027-01-01']))
            ->assertInertia(fn ($page) => $page
                ->where('saved', false)
                ->where('payslip.sss', 0)
                ->where('payslip.philhealth', 0)
                ->where('payslip.pagibig', 0)
                ->where('payslip.withholding_tax', 0)
                ->where('payslip.cash_advance', 0));

        // The month-end cut-off takes them from the last month-end payslip, not from Dec 1-15's zeros;
        // the overtime allowance still follows the payslip just before.
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2026-12-16']))
            ->assertInertia(fn ($page) => $page
                ->where('payslip.sss', 1350)
                ->where('payslip.philhealth', 750)
                ->where('payslip.pagibig', 200)
                ->where('payslip.withholding_tax', 1000)
                ->where('payslip.cash_advance', 500)
                ->where('payslip.overtime_allowance', 300));
    }
}
