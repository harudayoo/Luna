<?php

namespace Tests\Feature\Payroll;

use App\Models\Leave;
use App\Models\Payslip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Payslips: one per person per cut-off, made by HR and printable by HR and the employee.
 * "Today" is Thu 2026-11-12. Ana earns 60,000 a month (2,727.27 a day); Nov 3 and 4 are leave with
 * October's 6.66 h carried in, so Nov 1-15 has 6.01 unpaid hours (full accrual): 2,048.86 at 2,727.27/day.
 */
class PayslipTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-12 09:00:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create([
            'name' => 'Ana Cruz', 'pto_start' => '2026-10-01', 'daily_rate' => 2727.27,
        ]);
        $this->ana->forceFill(['monthly_salary' => 60000, 'position' => 'Developer'])->save();
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-03']);
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-04']);
    }

    private function save(string $cutoff, array $overrides = []): TestResponse
    {
        return $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, $cutoff]), $overrides + [
            'issued_on' => '2026-11-15',
            'holiday_regular_days' => 1,
            'holiday_special_days' => 1,
            'absences' => 4319.31,
            'overtime_allowance' => 500,
            'sss' => 1350,
            'philhealth' => 750,
            'pagibig' => 200,
            'withholding_tax' => 1000,
            'cash_advance' => 0,
        ]);
    }

    public function test_the_monthly_salary_sets_the_daily_rate()
    {
        $this->actingAs($this->hr)
            ->patch(route('people.update', $this->ana), [
                'monthly_salary' => 60000, 'position' => 'Senior Developer', 'pto_opening_hours' => 0,
            ])
            ->assertSessionHasNoErrors();

        $this->ana->refresh();
        $this->assertSame('2727.27', $this->ana->daily_rate);
        $this->assertSame('Senior Developer', $this->ana->position);
    }

    public function test_the_editor_is_prefilled_from_the_ledger()
    {
        $this->actingAs($this->hr)
            ->get(route('people.payroll.edit', [$this->ana, '2026-11-01']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/payslip')
                ->where('person.name', 'Ana Cruz')
                ->where('period.start', '2026-11-01')
                ->where('period.end', '2026-11-15')
                ->where('payslip.basic_pay', 30000)
                ->where('payslip.unpaid_hours', 6.01)
                ->where('payslip.absences', 2048.86)
                ->where('payslip.sss', 0)
                ->where('saved', false));
    }

    public function test_saving_computes_the_totals()
    {
        $this->save('2026-11-01')->assertSessionHasNoErrors()->assertRedirect();

        $slip = Payslip::sole();
        $this->assertSame(
            ['30000.00', '3545.45', '29726.14', '3300.00', '26426.14', 'Developer', '2026-11-15'],
            [$slip->basic_pay, $slip->holiday_pay, $slip->gross_pay, $slip->total_deductions, $slip->net_pay,
                $slip->position, $slip->issued_on->toDateString()],
        );

        // Saving again updates the same payslip.
        $this->save('2026-11-01', ['cash_advance' => 1000])->assertSessionHasNoErrors();
        $this->assertSame('25426.14', Payslip::sole()->net_pay);
    }

    public function test_the_next_payslip_reuses_the_previous_deductions()
    {
        $this->save('2026-11-01');

        $this->actingAs($this->hr)
            ->get(route('people.payroll.edit', [$this->ana, '2026-11-16']))
            ->assertInertia(fn ($page) => $page
                ->where('payslip.sss', 1350)
                ->where('payslip.philhealth', 750)
                ->where('payslip.pagibig', 200)
                ->where('payslip.withholding_tax', 1000)
                ->where('payslip.absences', 0));
    }

    public function test_bad_input_and_a_missing_salary_are_refused()
    {
        $this->save('2026-11-01', ['sss' => -5])->assertSessionHasErrors('sss');
        $this->save('2026-11-02')->assertSessionHasErrors('cutoff');

        $this->ana->forceFill(['monthly_salary' => null])->save();
        $this->save('2026-11-01')->assertSessionHasErrors('monthly_salary');
        $this->assertSame(0, Payslip::count());
    }

    public function test_the_payroll_list_shows_who_has_a_payslip()
    {
        $this->save('2026-11-01');

        $this->actingAs($this->hr)
            ->get(route('people.payroll', ['cutoff' => '2026-11-01']))
            ->assertInertia(fn ($page) => $page
                ->component('people/payroll')
                ->where('cutoff.start', '2026-11-01')
                ->where('rows.1.name', 'Ana Cruz')
                ->where('rows.1.net_pay', 26426.14)
                ->where('rows.0.payslip_id', null));
    }

    public function test_who_can_see_and_print()
    {
        $this->save('2026-11-01');
        $slip = Payslip::sole();

        $this->actingAs($this->ana)->get(route('people.payroll'))->assertForbidden();
        $this->actingAs($this->ana)->get(route('payslips.index'))
            ->assertInertia(fn ($page) => $page->component('payslips/index')->has('payslips', 1));
        $this->actingAs($this->ana)->get(route('payslips.print', $slip))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('print/payslip')
                ->where('paper', 'letter')
                ->where('payslip.name', 'Ana Cruz')
                ->where('payslip.position', 'Developer')
                ->where('payslip.monthly_salary', 60000)
                ->where('payslip.net_pay', 26426.14)
                ->where('company.name', 'Orchid City Software OPC'));

        $this->actingAs(User::factory()->create())->get(route('payslips.print', $slip))->assertForbidden();
        $this->actingAs($this->hr)->get(route('payslips.print', [$slip, 'paper' => 'a4']))
            ->assertInertia(fn ($page) => $page->where('paper', 'a4'));
        $this->actingAs($this->hr)->get(route('payslips.print', [$slip, 'paper' => 'tabloid']))
            ->assertSessionHasErrors('paper');
    }
}
