<?php

namespace Tests\Feature\Leave;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Leave and public holidays. "Today" is Wed 2026-11-11. The seeded 2026 list includes
 * Mon Nov 30 (Bonifacio Day) and Tue Dec 8 (Immaculate Conception).
 */
class HolidayLeaveTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->me = User::factory()->create(['pto_start' => '2026-10-01', 'pto_opening_hours' => 0]);
    }

    public function test_a_holiday_cannot_be_logged_as_leave()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-30'])
            ->assertSessionHasErrors(['from' => 'Nov 30 is Bonifacio Day.']);

        $this->assertSame(0, Leave::count());
    }

    public function test_a_range_skips_holidays_like_weekends()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-27', 'to' => '2026-12-01'])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            ['2026-11-27', '2026-12-01'],
            Leave::orderBy('date')->get()->map(fn (Leave $l) => $l->date->toDateString())->all(),
        );
    }

    public function test_leave_already_on_a_holiday_is_kept_marked_and_not_charged()
    {
        Leave::factory()->for($this->me)->create(['date' => '2026-11-30']);
        Leave::factory()->for($this->me)->create(['date' => '2026-11-27']);

        $this->actingAs($this->me)
            ->get(route('leave.index'))
            ->assertInertia(fn ($page) => $page
                ->where('month.used', 1)
                ->where('leaves.0.date', '2026-11-30')
                ->where('leaves.0.holiday', 'Bonifacio Day')
                ->where('leaves.1.holiday', null));

        $nov16 = collect($this->me->ptoLedger())->first(fn ($c) => $c->start->toDateString() === '2026-11-16');
        $this->assertSame(8.0, $nov16->takenHours);
    }

    public function test_the_monthly_cap_ignores_leave_on_holidays()
    {
        foreach (['01', '02', '03', '04', '07', '08', '09', '10', '11', '14'] as $d) {
            Leave::factory()->for($this->me)->create(['date' => "2026-12-$d"]);
        }

        // Ten logged, but Dec 8 is a holiday: one more fits.
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-15'])
            ->assertSessionHasNoErrors();
    }
}
