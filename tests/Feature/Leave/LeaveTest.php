<?php

namespace Tests\Feature\Leave;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Today" is Wed 2026-11-11, so the current cut-off is Nov 1-15 and Oct 16-31 has ended.
 */
class LeaveTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->me = User::factory()->create(['pto_start' => '2026-10-01', 'pto_opening_hours' => 0]);
    }

    public function test_an_employee_logs_a_full_day()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12', 'note' => 'Dentist'])
            ->assertRedirect(route('leave.index'))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('leaves', ['user_id' => $this->me->id, 'date' => '2026-11-12', 'days' => 1, 'note' => 'Dentist']);
    }

    public function test_an_employee_logs_a_half_day()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12', 'half_day' => true])
            ->assertSessionHasNoErrors();

        $this->assertSame(0.5, (float) Leave::sole()->days);
    }

    public function test_a_range_logs_each_weekday_and_skips_the_weekend()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12', 'to' => '2026-11-18'])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'],
            Leave::orderBy('date')->get()->map(fn (Leave $l) => $l->date->toDateString())->all(),
        );
    }

    public function test_weekend_only_dates_are_refused()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-14', 'to' => '2026-11-15'])
            ->assertSessionHasErrors('from');

        $this->assertSame(0, Leave::count());
    }

    public function test_a_date_already_logged_is_refused()
    {
        Leave::factory()->for($this->me)->create(['date' => '2026-11-12']);

        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12'])
            ->assertSessionHasErrors('from');
    }

    public function test_the_monthly_cap_of_ten_days_counts_half_days_as_half()
    {
        // 9.5 days in December (Dec 8 is a holiday, so it's skipped)
        foreach (['01', '02', '03', '04', '07', '09', '10', '11', '14'] as $d) {
            Leave::factory()->for($this->me)->create(['date' => "2026-12-$d"]);
        }
        Leave::factory()->for($this->me)->create(['date' => '2026-12-15', 'days' => 0.5]);

        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-16'])
            ->assertSessionHasErrors('from');

        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-16', 'half_day' => true])
            ->assertSessionHasNoErrors();
    }

    public function test_the_cap_is_checked_per_month_for_a_range()
    {
        foreach (['01', '02', '03', '04', '07', '09', '10', '11', '14', '15'] as $d) {
            Leave::factory()->for($this->me)->create(['date' => "2026-12-$d"]);
        }

        // Dec 28 would be the 11th December day (Dec 30, Dec 31 and Jan 1 are holidays).
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-28', 'to' => '2027-01-04'])
            ->assertSessionHasErrors('from');

        $this->assertSame(10, Leave::count());
    }

    public function test_dates_in_an_ended_cut_off_or_before_the_pto_start_are_refused()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-10-30'])
            ->assertSessionHasErrors('from');

        $this->me->update(['pto_start' => '2026-11-16']);
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12'])
            ->assertSessionHasErrors('from');

        $this->assertSame(0, Leave::count());
    }

    public function test_earlier_days_of_the_current_cut_off_can_still_be_logged()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-10'])
            ->assertSessionHasNoErrors();
    }

    public function test_an_employee_cancels_their_own_unlocked_leave()
    {
        $leave = Leave::factory()->for($this->me)->create(['date' => '2026-11-12']);

        $this->actingAs($this->me)
            ->delete(route('leave.destroy', $leave))
            ->assertRedirect(route('leave.index'));

        $this->assertModelMissing($leave);
    }

    public function test_leave_in_an_ended_cut_off_is_locked_for_the_employee()
    {
        $leave = Leave::factory()->for($this->me)->create(['date' => '2026-10-20']);

        $this->actingAs($this->me)
            ->delete(route('leave.destroy', $leave))
            ->assertForbidden();

        $this->assertModelExists($leave);
    }

    public function test_nobody_cancels_someone_elses_leave_except_hr()
    {
        $leave = Leave::factory()->for($this->me)->create(['date' => '2026-10-20']);

        $this->actingAs(User::factory()->create())
            ->delete(route('leave.destroy', $leave))
            ->assertForbidden();

        $this->actingAs(User::factory()->hr()->create())
            ->delete(route('leave.destroy', $leave))
            ->assertRedirect();

        $this->assertModelMissing($leave);
    }

    public function test_the_page_leads_with_the_balance_and_current_cut_off()
    {
        $this->me->update(['daily_rate' => 2000]);
        foreach ([['2026-10-05', 1], ['2026-10-06', 0.5], ['2026-10-20', 1], ['2026-11-03', 1], ['2026-11-04', 1]] as [$date, $days]) {
            Leave::factory()->for($this->me)->create(['date' => $date, 'days' => $days]);
        }

        $this->actingAs($this->me)
            ->get(route('leave.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leave/index')
                ->where('current.start', '2026-11-01')
                ->where('current.end', '2026-11-15')
                // Leave in the cut-off forfeits its accrual: all 16 h are unpaid.
                ->where('current.deducted_hours', 16)
                ->where('current.deducted_pesos', 4000)
                ->where('balance_hours', 0)
                ->has('leaves', 5)
                ->where('leaves.0.date', '2026-11-04')
                ->where('leaves.0.locked', false)
                ->where('leaves.2.date', '2026-10-20')
                ->where('leaves.2.locked', true));
    }

    public function test_the_dashboard_shows_the_balance()
    {
        $this->actingAs($this->me)
            ->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('pto.balance_hours', 6.67));
    }
}
