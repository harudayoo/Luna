<?php

namespace Tests\Feature\Payroll;

use App\Models\Payslip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Payroll release: HR records that each person received their pay for a cut-off, and prints the
 * Payroll Release Form everyone signs. "Today" is Sun 2026-11-15, payday for Nov 1-15.
 */
class PayrollReleaseTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    private User $ben;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-15 09:00:00');
        $this->hr = User::factory()->hr()->create(['name' => 'Hana Reyes']);
        $this->ana = $this->employee('Ana Cruz', 'Developer', 60000);
        $this->ben = $this->employee('Ben Santos', 'Designer', 40000);
    }

    private function employee(string $name, string $position, int $monthly): User
    {
        $user = User::factory()->create(['name' => $name, 'pto_start' => '2026-10-01']);
        $user->forceFill(['monthly_salary' => $monthly, 'position' => $position, 'daily_rate' => round($monthly / 22, 2)])->save();

        return $user;
    }

    private function save(User $user, string $cutoff = '2026-11-01', array $overrides = []): TestResponse
    {
        return $this->actingAs($this->hr)->put(route('people.payroll.update', [$user, $cutoff]), $overrides + [
            'issued_on' => '2026-11-15',
            'holiday_regular_days' => 0,
            'holiday_special_days' => 0,
            'absences' => 0,
            'overtime_allowance' => 0,
            'sss' => 1000,
            'philhealth' => 500,
            'pagibig' => 200,
            'withholding_tax' => 0,
            'cash_advance' => 0,
        ]);
    }

    private function slip(User $user, string $start = '2026-11-01'): Payslip
    {
        return Payslip::query()->where('user_id', $user->id)->where('period_start', $start)->sole();
    }

    public function test_hr_marks_a_payslip_received_and_can_undo_it()
    {
        $this->save($this->ana);
        $slip = $this->slip($this->ana);

        $this->actingAs($this->hr)
            ->patch(route('people.payroll.release', $slip), ['released' => true])
            ->assertSessionHasNoErrors()
            ->assertRedirect();
        $slip->refresh();
        $this->assertSame('2026-11-15', $slip->released_on->toDateString());
        $this->assertSame($this->hr->id, $slip->released_by);

        $this->actingAs($this->hr)
            ->patch(route('people.payroll.release', $slip), ['released' => true, 'released_on' => '2026-11-14'])
            ->assertSessionHasNoErrors();
        $this->assertSame('2026-11-14', $slip->refresh()->released_on->toDateString());

        $this->actingAs($this->hr)
            ->patch(route('people.payroll.release', $slip), ['released' => false])
            ->assertSessionHasNoErrors();
        $slip->refresh();
        $this->assertNull($slip->released_on);
        $this->assertNull($slip->released_by);
    }

    public function test_mark_all_received_only_touches_the_cutoffs_unreleased_payslips()
    {
        $this->save($this->ana);
        $this->save($this->ben);
        $this->save($this->ana, '2026-11-16');
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $this->slip($this->ben)), [
            'released' => true, 'released_on' => '2026-11-14',
        ]);

        $this->actingAs($this->hr)
            ->post(route('people.payroll.release.all'), ['cutoff' => '2026-11-01'])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertSame('2026-11-15', $this->slip($this->ana)->released_on->toDateString());
        $this->assertSame('2026-11-14', $this->slip($this->ben)->released_on->toDateString());
        $this->assertNull($this->slip($this->ana, '2026-11-16')->released_on);
    }

    public function test_a_released_payslip_cannot_be_edited()
    {
        $this->save($this->ana);
        $slip = $this->slip($this->ana);
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $slip), ['released' => true]);

        $this->save($this->ana, '2026-11-01', ['cash_advance' => 5000])->assertSessionHasErrors('released');
        $this->assertSame('0.00', $slip->refresh()->cash_advance);

        $this->actingAs($this->hr)
            ->get(route('people.payroll.edit', [$this->ana, '2026-11-01']))
            ->assertInertia(fn ($page) => $page->where('released_on', '2026-11-15'));
    }

    public function test_employees_cannot_release_or_print_the_form()
    {
        $this->save($this->ana);
        $slip = $this->slip($this->ana);

        $this->actingAs($this->ana)->patch(route('people.payroll.release', $slip), ['released' => true])->assertForbidden();
        $this->actingAs($this->ana)->post(route('people.payroll.release.all'), ['cutoff' => '2026-11-01'])->assertForbidden();
        $this->actingAs($this->ana)->get(route('people.payroll.release.print', ['cutoff' => '2026-11-01']))->assertForbidden();
        $this->assertNull($slip->refresh()->released_on);
    }

    public function test_the_release_form_lists_the_cutoffs_payslips()
    {
        $this->save($this->ben);
        $this->save($this->ana);
        $this->save($this->ana, '2026-11-16');
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $this->slip($this->ana)), ['released' => true]);

        $this->actingAs($this->hr)
            ->get(route('people.payroll.release.print', ['cutoff' => '2026-11-01']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('print/payroll-release')
                ->where('paper', 'letter')
                ->where('period.start', '2026-11-01')
                ->where('period.end', '2026-11-15')
                ->where('prepared_by', 'Hana Reyes')
                ->where('company.name', 'Orchid City Software OPC')
                ->has('rows', 2)
                ->where('rows.0.name', 'Ana Cruz')
                ->where('rows.0.position', 'Developer')
                ->where('rows.0.gross_pay', 30000)
                ->where('rows.0.total_deductions', 1700)
                ->where('rows.0.net_pay', 28300)
                ->where('rows.0.released_on', '2026-11-15')
                ->where('rows.1.name', 'Ben Santos')
                ->where('rows.1.net_pay', 18300)
                ->where('rows.1.released_on', null)
                ->where('totals.gross_pay', 50000)
                ->where('totals.total_deductions', 3400)
                ->where('totals.net_pay', 46600));

        $this->actingAs($this->hr)->get(route('people.payroll.release.print', ['cutoff' => '2026-11-01', 'paper' => 'legal']))
            ->assertInertia(fn ($page) => $page->where('paper', 'legal'));
        $this->actingAs($this->hr)->get(route('people.payroll.release.print', ['cutoff' => '2026-11-01', 'paper' => 'tabloid']))
            ->assertSessionHasErrors('paper');
    }

    public function test_the_payroll_list_shows_who_received_their_pay()
    {
        $this->save($this->ana);
        $this->save($this->ben);
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $this->slip($this->ana)), ['released' => true]);

        $this->actingAs($this->hr)
            ->get(route('people.payroll', ['cutoff' => '2026-11-01']))
            ->assertInertia(fn ($page) => $page
                ->where('released', 1)
                ->where('rows.1.name', 'Ana Cruz')
                ->where('rows.1.released_on', '2026-11-15')
                ->where('rows.2.released_on', null));
    }
}
