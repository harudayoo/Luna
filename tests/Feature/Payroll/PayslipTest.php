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
 * "Today" is Thu 2026-11-12. Ana earns 60,000 a month (346.15 an hour at x 12 / 260 / 8); Nov 3 and 4
 * are leave with October's 6.67 h carried in; the leave forfeits Nov 1-15's accrual, so it has 9.33 unpaid
 * hours, deducted on its own payslip: 3,230.77.
 */
class PayslipTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        // These payslips are per cut-off (half the salary each); the office default is monthly (PayFrequencyTest).
        config(['luna.pay.frequency' => 'semi_monthly']);
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

    public function test_saving_the_salary_no_longer_rewrites_the_stored_daily_rate()
    {
        // The rate follows the month now (PayRate); the stored daily_rate is only for people without a salary.
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
                ->where('payslip.unpaid_hours', 9.33)
                ->where('payslip.absences', 3333.33)
                ->where('payslip.sss', 0)
                ->where('saved', false));
    }

    public function test_saving_computes_the_totals()
    {
        $this->save('2026-11-01')->assertSessionHasNoErrors()->assertRedirect();

        $slip = Payslip::sole();
        $this->assertSame(
            ['30000.00', '3714.28', '29894.97', '3300.00', '26594.97', 'Developer', '2026-11-15'],
            [$slip->basic_pay, $slip->holiday_pay, $slip->gross_pay, $slip->total_deductions, $slip->net_pay,
                $slip->position, $slip->issued_on->toDateString()],
        );

        // Saving again updates the same payslip.
        $this->save('2026-11-01', ['cash_advance' => 1000])->assertSessionHasNoErrors();
        $this->assertSame('25594.97', Payslip::sole()->net_pay);
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
                // Not reused: absences come from the ledger, and Nov 16-30 has none.
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
                ->where('rows.1.net_pay', 26594.97)
                ->where('rows.0.payslip_id', null));
    }

    public function test_who_can_see_and_print()
    {
        $this->save('2026-11-01');
        $slip = Payslip::sole();

        // Payslips are HR and admin only (user, 2026-11-12): employees can't list or print them, not even their own.
        $this->actingAs($this->ana)->get(route('people.payroll'))->assertForbidden();
        $this->actingAs($this->ana)->get(route('payslips.index'))->assertForbidden();
        $this->actingAs($this->ana)->get(route('payslips.print', $slip))->assertForbidden();

        $this->actingAs($this->hr)->get(route('payslips.index'))->assertOk();
        $this->actingAs($this->hr)->get(route('payslips.print', $slip))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('print/payslip')
                ->where('paper', 'letter')
                ->where('payslip.name', 'Ana Cruz')
                ->where('payslip.position', 'Developer')
                ->where('payslip.monthly_salary', 60000)
                ->where('payslip.net_pay', 26594.97)
                ->where('company.name', 'Orchid City Software OPC'));

        $this->actingAs(User::factory()->create())->get(route('payslips.print', $slip))->assertForbidden();
        $this->actingAs($this->hr)->get(route('payslips.print', [$slip, 'paper' => 'a4']))
            ->assertInertia(fn ($page) => $page->where('paper', 'a4'));
        $this->actingAs($this->hr)->get(route('payslips.print', [$slip, 'paper' => 'tabloid']))
            ->assertSessionHasErrors('paper');
    }
}
