<?php

namespace Tests\Feature\Payroll;

use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** HR's view of one person's payslips, past ones included, to check, re-release and re-print. */
class PayslipHistoryTest extends TestCase
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

    public function test_hr_sees_every_payslip_of_a_person_newest_first()
    {
        $this->travelTo('2026-11-20 09:00:00');
        $hr = User::factory()->hr()->create();
        $ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->slip($ana, '2026-10-01', '2026-10-15', '2026-10-15');
        $this->slip($ana, '2026-11-01', '2026-11-15');
        $this->slip($ana, '2026-10-16', '2026-10-31', '2026-10-31');
        $this->slip(User::factory()->create(), '2026-11-01', '2026-11-15');

        $this->actingAs($hr)
            ->get(route('people.payslips', $ana))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/payslips')
                ->where('person.name', 'Ana Cruz')
                ->has('payslips', 3)
                ->where('payslips.0.start', '2026-11-01')
                ->where('payslips.0.released_on', null)
                ->where('payslips.0.net_pay', 30000)
                ->where('payslips.2.start', '2026-10-01')
                ->where('payslips.2.released_on', '2026-10-15'));

        $this->actingAs($ana)->get(route('people.payslips', $ana))->assertForbidden();
    }

    public function test_the_release_form_carries_each_payslip_for_the_half_sheet_prints()
    {
        $hr = User::factory()->hr()->create();
        $ben = User::factory()->create(['name' => 'Ben Santos']);
        $ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->slip($ben, '2026-11-01', '2026-11-15');
        $this->slip($ana, '2026-11-01', '2026-11-15');
        $this->slip($ana, '2026-10-16', '2026-10-31');

        $this->actingAs($hr)
            ->get(route('people.payroll.release.print', ['cutoff' => '2026-11-01']))
            ->assertInertia(fn ($page) => $page
                ->has('payslips', 2)
                ->where('payslips.0.name', 'Ana Cruz')
                ->where('payslips.0.start', '2026-11-01')
                ->where('payslips.0.basic_pay', 30000)
                ->where('payslips.0.net_pay', 30000)
                ->where('payslips.1.name', 'Ben Santos'));
    }
}
