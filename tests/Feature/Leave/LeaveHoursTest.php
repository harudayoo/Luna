<?php

namespace Tests\Feature\Leave;

use App\Models\Leave;
use App\Models\User;
use App\Services\Pto\Policy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Leave by the hour: a start and end time in 30-minute steps inside office hours (9:00-18:00, lunch 12-1,
 * user 2026-11-12). Only working hours count: 8 a day, so PTO is charged exactly those hours.
 * "Today" is Wed 2026-11-11.
 */
class LeaveHoursTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->me = User::factory()->create(['pto_start' => '2026-10-01']);
    }

    private function log(array $data)
    {
        return $this->actingAs($this->me)->post(route('leave.store'), $data + ['from' => '2026-11-12', 'part' => 'hours']);
    }

    /** @return list<array{0: string, 1: float, 2: string|null, 3: string|null}> */
    private function logged(): array
    {
        return Leave::orderBy('date')->get()
            ->map(fn (Leave $l) => [$l->date->toDateString(), (float) $l->days, $l->start_time, $l->end_time])->all();
    }

    public function test_an_afternoon_slot_counts_its_hours()
    {
        $this->log(['start_time' => '13:00', 'end_time' => '15:30'])->assertSessionHasNoErrors();

        // 2.5 h of an 8-hour day.
        $this->assertSame([['2026-11-12', 0.3125, '13:00', '15:30']], $this->logged());
    }

    public function test_the_lunch_hour_does_not_count()
    {
        $this->log(['start_time' => '10:00', 'end_time' => '14:00'])->assertSessionHasNoErrors();

        // 10-12 and 13-14: 3 h.
        $this->assertSame([['2026-11-12', 0.375, '10:00', '14:00']], $this->logged());
    }

    public function test_the_same_hours_across_a_range()
    {
        $this->log(['to' => '2026-11-13', 'start_time' => '16:00', 'end_time' => '18:00'])->assertSessionHasNoErrors();

        $this->assertSame(
            [['2026-11-12', 0.25, '16:00', '18:00'], ['2026-11-13', 0.25, '16:00', '18:00']],
            $this->logged(),
        );
    }

    public function test_bad_times_are_refused()
    {
        $this->log([])->assertSessionHasErrors(['start_time', 'end_time']);
        $this->log(['start_time' => '13:15', 'end_time' => '15:00'])->assertSessionHasErrors('start_time');
        $this->log(['start_time' => '08:00', 'end_time' => '10:00'])->assertSessionHasErrors('start_time');
        $this->log(['start_time' => '17:00', 'end_time' => '19:00'])->assertSessionHasErrors('end_time');
        $this->log(['start_time' => '15:00', 'end_time' => '14:00'])->assertSessionHasErrors('end_time');
        $this->log(['start_time' => '12:00', 'end_time' => '13:00'])->assertSessionHasErrors('end_time');
        $this->assertSame(0, Leave::count());
    }

    public function test_pto_is_charged_the_exact_hours()
    {
        $this->log(['start_time' => '09:00', 'end_time' => '11:30'])->assertSessionHasNoErrors();

        $this->actingAs($this->me)->get(route('leave.index'))
            ->assertInertia(fn ($page) => $page
                ->where('leaves.0.start_time', '09:00')
                ->where('leaves.0.end_time', '11:30')
                ->where('leaves.0.days', 0.3125));

        $cut = collect($this->me->ptoLedger(Policy::current(), now()->toImmutable()->endOfYear()))
            ->first(fn ($c) => $c->start->toDateString() === '2026-11-01');
        $this->assertSame(2.5, $cut->takenHours);
    }

    public function test_hr_logs_hours_for_someone_and_the_times_show_everywhere()
    {
        $ana = User::factory()->create(['pto_start' => '2026-10-01']);
        $hr = User::factory()->hr()->create();

        $this->actingAs($hr)
            ->post(route('people.leave.store', $ana), [
                'from' => '2026-11-12', 'part' => 'hours', 'start_time' => '14:00', 'end_time' => '16:00',
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($hr)->get(route('calendar.index'))
            ->assertInertia(fn ($page) => $page->where('leaves.0.start_time', '14:00')->where('leaves.0.end_time', '16:00'));
        $this->actingAs($hr)->get(route('people.leave'))
            ->assertInertia(fn ($page) => $page->where('rows.1.leaves.0.start_time', '14:00'));
    }
}
