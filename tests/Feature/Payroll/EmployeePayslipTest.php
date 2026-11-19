<?php

namespace Tests\Feature\Payroll;

use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Employees see and print their own payslips once HR has released them; unreleased ones stay with HR. */
class EmployeePayslipTest extends TestCase
{
    use RefreshDatabase;

    private function slip(User $user, string $start, string $end, ?string $released = null): Payslip
    {
        $inputs = array_fill_keys(Payslip::INPUTS, 0);

        return Payslip::create($inputs + PayslipMath::totals(60000, 2727.27, $inputs) + [
            'user_id' => $user->id, 'period_start' => $start, 'period_end' => $end, 'issued_on' => $end,
            'position' => 'Developer', 'monthly_salary' => 60000, 'daily_rate' => 2727.27, 'released_on' => $released,
        ]);
    }

    public function test_an_employee_sees_and_prints_only_their_released_payslips()
    {
        $this->travelTo('2026-11-20 09:00:00');
        $ana = User::factory()->create();
        $released = $this->slip($ana, '2026-10-01', '2026-10-31', '2026-10-31');
        $pending = $this->slip($ana, '2026-11-01', '2026-11-30');
        $others = $this->slip(User::factory()->create(), '2026-10-01', '2026-10-31', '2026-10-31');

        $this->actingAs($ana)->get(route('payslips.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('payslips', 1)->where('payslips.0.id', $released->id));

        $this->actingAs($ana)->get(route('payslips.print', $released))->assertOk()
            ->assertInertia(fn ($page) => $page->where('back', route('payslips.index')));
        $this->actingAs($ana)->get(route('payslips.print', $pending))->assertForbidden();
        $this->actingAs($ana)->get(route('payslips.print', $others))->assertForbidden();
    }

    public function test_hr_still_sees_every_own_payslip_and_prints_anyones()
    {
        $hr = User::factory()->hr()->create();
        $this->slip($hr, '2026-10-01', '2026-10-31', '2026-10-31');
        $this->slip($hr, '2026-11-01', '2026-11-30');
        $pending = $this->slip(User::factory()->create(), '2026-11-01', '2026-11-30');

        $this->actingAs($hr)->get(route('payslips.index'))->assertInertia(fn ($page) => $page->has('payslips', 2));
        $this->actingAs($hr)->get(route('payslips.print', $pending))->assertOk()
            ->assertInertia(fn ($page) => $page->where('back', route('people.payroll', ['cutoff' => '2026-11-01'])));
    }
}
