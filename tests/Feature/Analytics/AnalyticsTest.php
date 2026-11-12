<?php

namespace Tests\Feature\Analytics;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Analytics: my PTO over the year (everyone) and the office views (HR). "Today" is Wed 2026-11-11.
 * Ana's leave matches the planner golden case (Oct 5, Oct 6 ½, Oct 20, Nov 3, Nov 4) plus Nov 20,
 * Dec 1 (coming up) and Nov 30 (a holiday: never counted). Full accrual, 3.33 h per cut-off.
 */
class AnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-10-01', 'pto_opening_hours' => 0, 'daily_rate' => 2000]);

        foreach ([['2026-10-05', 1], ['2026-10-06', 0.5], ['2026-10-20', 1], ['2026-11-03', 1], ['2026-11-04', 1],
            ['2026-11-20', 1], ['2026-11-30', 1], ['2026-12-01', 1]] as [$date, $days]) {
            Leave::factory()->for($this->ana)->create(['date' => $date, 'days' => $days]);
        }
    }

    public function test_guests_are_redirected()
    {
        $this->get(route('analytics.index'))->assertRedirect(route('login'));
    }

    public function test_an_employee_sees_their_own_pto_and_no_office_data()
    {
        $this->actingAs($this->ana)
            ->get(route('analytics.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('analytics/index')
                ->where('year', 2026)
                ->where('years', [2026])
                ->where('me.balance_hours', 0)
                ->where('me.taken_days', 6.5)
                // Every cut-off with leave forfeits its accrual.
                ->where('me.unpaid_hours', 52)
                ->where('me.unpaid_pesos', 13000)
                ->has('me.cutoffs', 6)
                ->where('me.cutoffs.0.start', '2026-10-01')
                ->where('me.cutoffs.0.balance', -12)
                ->where('me.cutoffs.0.deducted_pesos', 3000)
                ->where('me.cutoffs.5.start', '2026-12-16')
                ->where('me.cutoffs.5.balance', 3.33)
                ->missing('office'));
    }

    public function test_hr_sees_the_office_views()
    {
        $this->actingAs(User::factory()->hr()->create(['pto_start' => '2026-10-01']))
            ->get(route('analytics.index'))
            ->assertInertia(fn ($page) => $page
                ->has('office.months', 12)
                ->where('office.months.9', ['month' => '2026-10', 'days' => 2.5])
                ->where('office.months.10', ['month' => '2026-11', 'days' => 3])
                ->where('office.months.11', ['month' => '2026-12', 'days' => 1])
                ->where('office.weekdays', [
                    ['day' => 'Mon', 'days' => 1], ['day' => 'Tue', 'days' => 3.5], ['day' => 'Wed', 'days' => 1],
                    ['day' => 'Thu', 'days' => 0], ['day' => 'Fri', 'days' => 1],
                ])
                ->where('office.people.0.name', 'Ana Cruz')
                ->where('office.people.0.days', 6.5)
                ->where('office.people.0.deducted_hours', 52)
                ->where('office.totals.deducted_hours', 52)
                ->where('office.totals.deducted_pesos', 13000)
                ->where('office.cutoffs.0.start', '2026-10-01')
                ->where('office.cutoffs.0.deducted_hours', 12)
                ->where('office.cutoffs.0.people', 1)
                ->has('office.upcoming', 1)
                ->where('office.upcoming.0.name', 'Ana Cruz')
                ->where('office.upcoming.0.dates', [['date' => '2026-11-20', 'days' => 1], ['date' => '2026-12-01', 'days' => 1]])
                ->where('office.upcoming.0.days', 2));
    }

    public function test_another_year_and_bad_input()
    {
        $this->actingAs($this->ana)
            ->get(route('analytics.index', ['year' => 2027]))
            ->assertInertia(fn ($page) => $page->where('year', 2027)->where('me.taken_days', 0));

        $this->actingAs($this->ana)
            ->get(route('analytics.index', ['year' => 'soon']))
            ->assertSessionHasErrors('year');
    }

    public function test_the_dashboard_links_analytics()
    {
        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk();
        $this->assertTrue(str_contains(file_get_contents(resource_path('js/modules.ts')), "'/analytics'"));
    }
}
