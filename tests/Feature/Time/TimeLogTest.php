<?php

namespace Tests\Feature\Time;

use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The four daily time logs: each person stamps their own (server time, Manila), in order; HR fixes them.
 * They're a record only: nothing is charged from them. "Now" is Fri 2026-11-13 09:15 in Manila (01:15 UTC).
 */
class TimeLogTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-13 01:15:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
    }

    private function stamp(string $step)
    {
        return $this->actingAs($this->ana)->post(route('time.stamp'), ['step' => $step]);
    }

    private function today(): ?TimeLog
    {
        return TimeLog::query()->where('user_id', $this->ana->id)->where('date', '2026-11-13')->first();
    }

    public function test_stamps_record_the_manila_time_in_order()
    {
        $this->stamp('time_in')->assertSessionHasNoErrors();
        $this->travelTo('2026-11-13 04:02:00');
        $this->stamp('lunch_start')->assertSessionHasNoErrors();
        $this->travelTo('2026-11-13 05:01:00');
        $this->stamp('lunch_end')->assertSessionHasNoErrors();
        $this->travelTo('2026-11-13 10:03:00');
        $this->stamp('time_out')->assertSessionHasNoErrors();

        $log = $this->today();
        $this->assertSame(['09:15', '12:02', '13:01', '18:03'], [$log->time_in, $log->lunch_start, $log->lunch_end, $log->time_out]);
    }

    public function test_a_repeat_or_out_of_order_stamp_is_refused()
    {
        $this->stamp('lunch_start')->assertSessionHasErrors('step');
        $this->assertNull($this->today());

        $this->stamp('time_in')->assertSessionHasNoErrors();
        $this->travelTo('2026-11-13 01:30:00');
        $this->stamp('time_in')->assertSessionHasErrors('step');
        $this->assertSame('09:15', $this->today()->time_in);

        $this->stamp('lunch_end')->assertSessionHasErrors('step');
    }

    public function test_time_out_without_a_lunch_break_is_allowed()
    {
        $this->stamp('time_in');
        $this->travelTo('2026-11-13 04:00:00');
        $this->stamp('time_out')->assertSessionHasNoErrors();

        $this->assertSame('12:00', $this->today()->time_out);
        $this->assertNull($this->today()->lunch_start);
        $this->stamp('lunch_start')->assertSessionHasErrors('step');
    }

    public function test_only_hr_sets_anyones_stamps()
    {
        $times = ['time_in' => '08:55', 'lunch_start' => '12:00', 'lunch_end' => '13:00', 'time_out' => null];

        $this->actingAs($this->ana)->put(route('people.time.update', [$this->ana, '2026-11-12']), $times)->assertForbidden();

        $this->actingAs($this->hr)->put(route('people.time.update', [$this->ana, '2026-11-12']), $times)->assertSessionHasNoErrors();
        $log = TimeLog::query()->where('user_id', $this->ana->id)->where('date', '2026-11-12')->first();
        $this->assertSame(['08:55', '12:00', '13:00', null], [$log->time_in, $log->lunch_start, $log->lunch_end, $log->time_out]);

        // Out of order is refused.
        $this->actingAs($this->hr)->put(route('people.time.update', [$this->ana, '2026-11-12']), ['lunch_end' => '11:00'] + $times)
            ->assertSessionHasErrors('lunch_end');
    }

    public function test_hr_sees_a_days_stamps_for_everyone()
    {
        $this->stamp('time_in');

        $this->actingAs($this->hr)->get(route('people.time', ['date' => '2026-11-13']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/time')
                ->where('date', '2026-11-13')
                ->where('rows.1.name', 'Ana Cruz')
                ->where('rows.1.time_in', '09:15'));

        $this->actingAs($this->ana)->get(route('people.time'))->assertForbidden();
    }

    public function test_home_shows_todays_stamps_and_the_wip_channels()
    {
        $this->stamp('time_in');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page
                ->where('today.date', '2026-11-13')
                ->where('today.time_in', '09:15')
                ->where('today.next', 'lunch_start')
                ->has('wip', 4)
                ->where('wip.0.key', 'attendance')
                ->where('wip.0.url', 'https://wip.quicksilversystems.com/servers/1d2a17e2-6f7d-48b3-8b00-de9e39fd23b1/channels/a0b29c6f-4200-4817-9e2d-23b29f893cd2'));
    }
}
