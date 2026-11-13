<?php

namespace Tests\Feature\Payroll;

use App\Models\Leave;
use App\Models\Payslip;
use App\Models\Setting;
use App\Models\User;
use App\Services\Payroll\PayFrequency;
use App\Services\Payroll\PaySchedule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pay frequency: the office has been paid monthly since August 2026; HR may switch to per cut-off (15th and
 * month end) from a month they pick. PTO stays per cut-off either way, so a monthly payslip adds up both
 * cut-offs' unpaid hours. "Today" is Thu 2026-11-12.
 *
 * Ana earns 60,000 (346.15 an hour). Nov 3 and 4 are leave with October's 6.67 h carried in: Nov 1-15 has
 * 9.33 unpaid hours. Nov 20 is leave too: Nov 16-30 forfeits its accrual and has 8 unpaid. The month has
 * 17.33 h, priced once: 6,000.00.
 */
class PayFrequencyTest extends TestCase
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
        foreach (['2026-11-03', '2026-11-04', '2026-11-20'] as $date) {
            Leave::factory()->for($this->ana)->create(['date' => $date]);
        }
    }

    private function payload(): array
    {
        return [
            'issued_on' => '2026-11-30', 'holiday_regular_days' => 0, 'holiday_special_days' => 0, 'absences' => 0,
            'overtime_allowance' => 0, 'sss' => 0, 'philhealth' => 0, 'pagibig' => 0, 'withholding_tax' => 0, 'cash_advance' => 0,
        ];
    }

    public function test_hr_and_admin_see_the_formulas_and_employees_do_not()
    {
        $this->actingAs($this->hr)->get(route('people.formulas'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/formulas')
                ->where('frequency', 'monthly')
                ->where('work_days.days', 21)
                ->where('policy.hours_per_day', 8)
                ->where('policy.accrual_mode', 'forfeit')
                ->has('schedule'));

        $this->actingAs(User::factory()->admin()->create())->get(route('people.formulas'))->assertOk();
        $this->actingAs($this->ana)->get(route('people.formulas'))->assertForbidden();
    }

    public function test_pay_is_monthly_by_default()
    {
        $this->assertSame(PayFrequency::Monthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2026-08-18')));

        $this->actingAs($this->hr)->get(route('people.payroll', ['cutoff' => '2026-11-20']))
            ->assertInertia(fn ($page) => $page
                ->where('cutoff.start', '2026-11-01')
                ->where('cutoff.end', '2026-11-30')
                ->where('cutoff.prev', '2026-10-01')
                ->where('cutoff.next', '2026-12-01')
                ->where('frequency', 'monthly'));
    }

    public function test_a_monthly_payslip_pays_the_whole_salary_less_both_cut_offs_unpaid_hours()
    {
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2026-11-01']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('period.end', '2026-11-30')
                ->where('frequency', 'monthly')
                ->where('payslip.basic_pay', 60000)
                ->where('payslip.unpaid_hours', 17.33)
                ->where('payslip.absences', 6190.48));

        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), ['absences' => 6000] + $this->payload())
            ->assertSessionHasNoErrors();

        $slip = Payslip::sole();
        $this->assertSame(['2026-11-30', '60000.00', '54000.00', '17.33'],
            [$slip->period_end->toDateString(), $slip->basic_pay, $slip->net_pay, $slip->unpaid_hours]);
    }

    public function test_a_monthly_period_cannot_start_on_the_16th()
    {
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2026-11-16']))
            ->assertSessionHasErrors('cutoff');
    }

    public function test_hr_switches_to_per_cut_off_from_a_chosen_month()
    {
        $this->actingAs($this->hr)
            ->put(route('people.formulas.frequency'), ['frequency' => 'semi_monthly', 'from' => '2027-01'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('people.formulas'));

        $this->assertSame(PayFrequency::Monthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2026-12-31')));
        $this->assertSame(PayFrequency::SemiMonthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2027-01-01')));
        $this->assertSame(['2026-12-01', '2026-12-31'], array_map(fn ($d) => $d->toDateString(), PaySchedule::periodFor(CarbonImmutable::parse('2026-12-20'))));
        $this->assertSame(['2027-01-16', '2027-01-31'], array_map(fn ($d) => $d->toDateString(), PaySchedule::periodFor(CarbonImmutable::parse('2027-01-20'))));

        // The first cut-off of January steps back to the whole of December.
        $this->actingAs($this->hr)->get(route('people.payroll', ['cutoff' => '2027-01-01']))
            ->assertInertia(fn ($page) => $page
                ->where('cutoff.end', '2027-01-15')
                ->where('cutoff.prev', '2026-12-01')
                ->where('frequency', 'semi_monthly'));

        // Per cut-off: half the salary.
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2027-01-16']))
            ->assertInertia(fn ($page) => $page->where('payslip.basic_pay', 30000)->where('period.end', '2027-01-31'));
    }

    public function test_switching_back_keeps_the_months_in_between()
    {
        PaySchedule::change(PayFrequency::SemiMonthly, '2027-01');
        PaySchedule::change(PayFrequency::Monthly, '2027-03');

        $this->assertSame(PayFrequency::Monthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2026-12-10')));
        $this->assertSame(PayFrequency::SemiMonthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2027-02-10')));
        $this->assertSame(PayFrequency::Monthly, PaySchedule::frequencyOn(CarbonImmutable::parse('2027-03-10')));
    }

    public function test_a_switch_is_refused_for_a_month_that_has_payslips()
    {
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payload());

        $this->actingAs($this->hr)
            ->put(route('people.formulas.frequency'), ['frequency' => 'semi_monthly', 'from' => '2026-11'])
            ->assertSessionHasErrors('from');
        $this->assertNull(Setting::get('pay.schedule'));
    }

    public function test_employees_cannot_change_the_frequency()
    {
        $this->actingAs($this->ana)
            ->put(route('people.formulas.frequency'), ['frequency' => 'semi_monthly', 'from' => '2027-01'])
            ->assertForbidden();
    }

    public function test_the_release_form_covers_the_month()
    {
        $this->actingAs($this->hr)->get(route('people.payroll.release.print', ['cutoff' => '2026-11-20']))
            ->assertInertia(fn ($page) => $page->where('period.start', '2026-11-01')->where('period.end', '2026-11-30'));
    }
}
