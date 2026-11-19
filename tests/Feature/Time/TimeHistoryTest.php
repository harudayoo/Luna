<?php

namespace Tests\Feature\Time;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Each person's own time log history on the Time page, a month at a time. "Now" is 2026-11-19 in Manila. */
class TimeHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_my_days_for_the_month_newest_first_with_the_time_worked()
    {
        $this->travelTo('2026-11-19 02:00:00');
        $ana = User::factory()->create();
        $ana->timeLogs()->create(['date' => '2026-11-17', 'time_in' => '09:00', 'lunch_start' => '12:00', 'lunch_end' => '13:00', 'time_out' => '18:00']);
        $ana->timeLogs()->create(['date' => '2026-11-18', 'time_in' => '09:30', 'time_out' => '17:00']);
        $ana->timeLogs()->create(['date' => '2026-11-19', 'time_in' => '09:05']);
        $ana->timeLogs()->create(['date' => '2026-10-30', 'time_in' => '09:00', 'time_out' => '18:00']);
        User::factory()->create()->timeLogs()->create(['date' => '2026-11-18', 'time_in' => '08:00']);

        $this->actingAs($ana)->get(route('time.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('history.month', '2026-11')
                ->where('history.prev', '2026-10')
                ->where('history.next', null)
                ->has('history.days', 3)
                ->where('history.days.0.date', '2026-11-19')
                ->where('history.days.0.worked_minutes', null)
                ->where('history.days.1.worked_minutes', 450)
                ->where('history.days.2.worked_minutes', 480)
                ->where('history.days.2.lunch_start', '12:00'));

        $this->actingAs($ana)->get(route('time.index', ['month' => '2026-10']))
            ->assertInertia(fn ($page) => $page
                ->where('history.next', '2026-11')
                ->has('history.days', 1)
                ->where('history.days.0.worked_minutes', 540));

        $this->actingAs($ana)->get(route('time.index', ['month' => 'soon']))->assertSessionHasErrors('month');
    }
}
