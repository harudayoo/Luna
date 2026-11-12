<?php

namespace Tests\Feature\People;

use App\Models\Leave;
use App\Models\User;
use App\Services\Pto\AccrualMode;
use App\Services\Pto\Policy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * HR's side of PTO: the office policy, each person's PTO values, and everyone's leave and
 * deductions per cut-off. "Today" is Wed 2026-11-11; the office started 2026-08-18.
 */
class HrPtoTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->hr = User::factory()->hr()->create(['name' => 'Maria HR']);
    }

    public function test_hr_sees_the_office_policy_and_employees_cannot()
    {
        $this->actingAs($this->hr)
            ->get(route('people.policy'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/policy')
                ->where('policy.accrual_mode', 'full')
                ->where('policy.accrual_hours', 3.3333)
                ->where('policy.monthly_cap_days', 10)
                ->where('policy.office_started_on', '2026-08-18')
                ->has('modes', 3));

        $this->actingAs(User::factory()->create())
            ->get(route('people.policy'))
            ->assertForbidden();
    }

    public function test_hr_changes_the_policy_for_everyone()
    {
        $this->actingAs($this->hr)
            ->put(route('people.policy.update'), [
                'accrual_mode' => 'unpaid',
                'accrual_hours' => 3.5,
                'monthly_cap_days' => 8,
                'office_started_on' => '2026-08-18',
                'work_days_per_year' => 260,
            ])
            ->assertRedirect(route('people.policy'))
            ->assertSessionHasNoErrors();

        $policy = Policy::current();
        $this->assertSame(AccrualMode::Unpaid, $policy->mode);
        $this->assertSame(3.5, $policy->accrualHours);
        $this->assertSame(8.0, $policy->monthlyCapDays);
    }

    public function test_the_policy_rejects_nonsense()
    {
        $this->actingAs($this->hr)
            ->put(route('people.policy.update'), [
                'accrual_mode' => 'double',
                'accrual_hours' => -1,
                'monthly_cap_days' => 0,
                'office_started_on' => 'soon',
                'work_days_per_year' => 12,
            ])
            ->assertSessionHasErrors(['accrual_mode', 'accrual_hours', 'monthly_cap_days', 'office_started_on', 'work_days_per_year']);

        $this->assertSame(AccrualMode::Full, Policy::current()->mode);
    }

    public function test_hr_sets_a_persons_rate_start_and_opening_balance()
    {
        $juan = User::factory()->create();

        $this->actingAs($this->hr)
            ->patch(route('people.update', $juan), [
                'daily_rate' => 1800,
                'pto_start' => '2026-09-01',
                'pto_opening_hours' => 4,
            ])
            ->assertRedirect(route('people.index'))
            ->assertSessionHasNoErrors();

        $juan->refresh();
        $this->assertSame('1800.00', $juan->daily_rate);
        $this->assertSame('2026-09-01', $juan->ptoStart()->toDateString());
        $this->assertSame('4.00', $juan->pto_opening_hours);
    }

    public function test_person_values_are_validated_and_hr_only()
    {
        $juan = User::factory()->create();

        $this->actingAs($this->hr)
            ->patch(route('people.update', $juan), [
                'daily_rate' => -5,
                'pto_start' => '2026-08-01',
                'pto_opening_hours' => -1,
            ])
            ->assertSessionHasErrors(['daily_rate', 'pto_start', 'pto_opening_hours']);

        $this->actingAs(User::factory()->create())
            ->patch(route('people.update', $juan), ['daily_rate' => 9999])
            ->assertForbidden();

        $this->assertNull($juan->fresh()->daily_rate);
    }

    public function test_hr_sees_everyones_leave_and_deductions_for_the_current_cut_off()
    {
        $juan = User::factory()->create(['name' => 'Juan', 'pto_start' => '2026-11-01', 'daily_rate' => 2000]);
        Leave::factory()->for($juan)->create(['date' => '2026-11-03']);
        Leave::factory()->for($juan)->create(['date' => '2026-11-04']);

        $this->actingAs($this->hr)
            ->get(route('people.leave'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/leave')
                ->where('cutoff.start', '2026-11-01')
                ->where('cutoff.end', '2026-11-15')
                ->where('cutoff.prev', '2026-10-16')
                ->where('cutoff.next', '2026-11-16')
                ->has('rows', 2)
                ->where('rows.1.name', 'Juan')
                ->where('rows.1.taken_hours', 16)
                ->where('rows.1.deducted_hours', 12.67)
                ->where('rows.1.deducted_pesos', 3167.5)
                ->has('rows.1.leaves', 2)
                ->where('totals.deducted_pesos', 3167.5));
    }

    public function test_hr_can_look_at_another_cut_off()
    {
        $this->actingAs($this->hr)
            ->get(route('people.leave', ['cutoff' => '2026-10-20']))
            ->assertInertia(fn ($page) => $page
                ->where('cutoff.start', '2026-10-16')
                ->where('cutoff.end', '2026-10-31'));
    }

    public function test_employees_cannot_see_everyones_leave()
    {
        $this->actingAs(User::factory()->create())
            ->get(route('people.leave'))
            ->assertForbidden();
    }
}
