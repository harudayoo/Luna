<?php

namespace Tests\Feature\Calendar;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The shared calendar: everyone's leave and the holidays, one month at a time.
 * "Today" is Wed 2026-11-11; Nov 1, Nov 2 and Nov 30 are seeded holidays.
 */
class CalendarTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->me = User::factory()->create(['name' => 'Me Myself']);
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);

        Leave::factory()->for($this->me)->create(['date' => '2026-11-12', 'note' => 'Dentist']);
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-11', 'days' => 0.5, 'note' => 'Family thing']);
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-30']); // a holiday: not listed
        Leave::factory()->for($this->ana)->create(['date' => '2026-12-01']); // next month
    }

    public function test_guests_are_redirected()
    {
        $this->get(route('calendar.index'))->assertRedirect(route('login'));
    }

    public function test_everyone_sees_the_month_with_names_and_holidays()
    {
        $this->actingAs($this->me)
            ->get(route('calendar.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('calendar/index')
                ->where('month', '2026-11')
                ->where('prev', '2026-10')
                ->where('next', '2026-12')
                ->where('today', '2026-11-11')
                ->has('holidays', 3)
                ->where('holidays.0.date', '2026-11-01')
                ->where('holidays.2.name', 'Bonifacio Day')
                ->has('leaves', 2)
                ->where('leaves.0.date', '2026-11-11')
                ->where('leaves.0.name', 'Ana Cruz')
                ->where('leaves.0.days', 0.5)
                ->where('leaves.0.mine', false)
                ->where('leaves.1.date', '2026-11-12')
                ->where('leaves.1.mine', true));
    }

    public function test_notes_are_private_to_the_owner_and_hr()
    {
        $this->actingAs($this->me)
            ->get(route('calendar.index'))
            ->assertInertia(fn ($page) => $page
                ->where('leaves.0.note', null)
                ->where('leaves.1.note', 'Dentist'));

        $this->actingAs(User::factory()->hr()->create())
            ->get(route('calendar.index'))
            ->assertInertia(fn ($page) => $page
                ->where('leaves.0.note', 'Family thing')
                ->where('leaves.1.note', 'Dentist'));
    }

    public function test_another_month_and_bad_input()
    {
        $this->actingAs($this->me)
            ->get(route('calendar.index', ['month' => '2026-12']))
            ->assertInertia(fn ($page) => $page
                ->where('month', '2026-12')
                ->where('prev', '2026-11')
                ->where('next', '2027-01')
                ->has('leaves', 1)
                ->has('holidays', 5));

        $this->actingAs($this->me)
            ->get(route('calendar.index', ['month' => '2026-13']))
            ->assertSessionHasErrors('month');
    }

    public function test_the_dashboard_counts_who_is_out_today()
    {
        $this->actingAs($this->me)
            ->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page->where('out_today', 1));
    }
}
