<?php

namespace Tests\Feature\Time;

use App\Models\Holiday;
use App\Models\LateLog;
use App\Models\Leave;
use App\Models\Payslip;
use App\Models\User;
use App\Services\Pto\CutOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Lates are what people declare (honour system, as posted in WIP's OCS Attendance channel): late in, a long
 * lunch, early out or an errand, as a time span. Only office hours count (9-12, 1-6). "Today" is Fri 2026-11-13.
 */
class LateLogTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-13 01:15:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-10-01']);
        $this->ana->forceFill(['monthly_salary' => 60000])->save();
    }

    private function late(array $input, ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->ana)->post(route('time.lates.store'), $input + [
            'date' => '2026-11-13', 'kind' => 'late_in', 'start_time' => '09:00', 'end_time' => '09:47', 'note' => 'Traffic',
        ]);
    }

    public function test_a_late_charges_only_office_hour_minutes()
    {
        $this->late([])->assertSessionHasNoErrors();
        $this->late(['date' => '2026-11-12', 'kind' => 'errand', 'start_time' => '12:30', 'end_time' => '13:40'])->assertSessionHasNoErrors();
        $this->late(['date' => '2026-11-11', 'kind' => 'early_out', 'start_time' => '17:15', 'end_time' => '18:00'])->assertSessionHasNoErrors();

        $this->assertSame([47, 40, 45], LateLog::query()->orderByDesc('date')->pluck('minutes')->all());
        $this->assertSame('Traffic', LateLog::query()->where('date', '2026-11-13')->first()->note);
    }

    public function test_lunch_only_weekend_holiday_and_future_are_refused()
    {
        Holiday::query()->create(['date' => '2026-11-10', 'name' => 'Test holiday', 'kind' => 'special']);

        $this->late(['kind' => 'lunch', 'start_time' => '12:10', 'end_time' => '12:50'])->assertSessionHasErrors('end_time');
        $this->late(['start_time' => '09:30', 'end_time' => '09:10'])->assertSessionHasErrors('end_time');
        $this->late(['date' => '2026-11-14'])->assertSessionHasErrors('date');
        $this->late(['date' => '2026-11-10'])->assertSessionHasErrors('date');
        $this->late(['date' => '2026-11-16'])->assertSessionHasErrors('date');
        $this->late(['kind' => 'nap'])->assertSessionHasErrors('kind');

        $this->assertSame(0, LateLog::query()->count());
    }

    public function test_it_cant_overlap_leave_or_another_late()
    {
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-12', 'days' => 0.375, 'part' => 'am']);
        $this->late(['date' => '2026-11-12', 'start_time' => '09:00', 'end_time' => '09:30'])->assertSessionHasErrors('start_time');
        $this->late(['date' => '2026-11-12', 'kind' => 'lunch', 'start_time' => '13:00', 'end_time' => '13:30'])->assertSessionHasNoErrors();

        $this->late(['kind' => 'errand', 'start_time' => '09:30', 'end_time' => '10:00'])->assertSessionHasNoErrors();
        $this->late(['start_time' => '09:00', 'end_time' => '09:45'])->assertSessionHasErrors('start_time');
    }

    public function test_a_released_period_is_locked_for_employees_but_not_hr()
    {
        Payslip::query()->forceCreate([
            'user_id' => $this->ana->id, 'period_start' => '2026-10-01', 'period_end' => '2026-10-31', 'issued_on' => '2026-10-31',
            'monthly_salary' => 60000, 'daily_rate' => 2769.23, 'basic_pay' => 60000, 'gross_pay' => 60000,
            'total_deductions' => 0, 'net_pay' => 60000, 'released_on' => '2026-10-31',
        ]);

        $this->late(['date' => '2026-10-30'])->assertSessionHasErrors('date');

        $this->actingAs($this->hr)->post(route('people.lates.store', $this->ana), [
            'date' => '2026-10-30', 'kind' => 'late_in', 'start_time' => '09:00', 'end_time' => '09:20',
        ])->assertSessionHasNoErrors();
        $this->assertSame(20, $this->ana->lateLogs()->first()->minutes);
    }

    public function test_cancelling_own_late_or_by_hr()
    {
        $this->late([]);
        $mine = LateLog::query()->first();
        $ben = User::factory()->create();

        $this->actingAs($ben)->delete(route('time.lates.destroy', $mine))->assertForbidden();
        $this->actingAs($this->ana)->delete(route('time.lates.destroy', $mine))->assertSessionHasNoErrors();
        $this->assertSame(0, LateLog::query()->count());

        $this->late([]);
        $this->actingAs($this->hr)->delete(route('time.lates.destroy', LateLog::query()->first()))->assertSessionHasNoErrors();
        $this->assertSame(0, LateLog::query()->count());
    }

    public function test_lates_dont_touch_pto()
    {
        $before = collect($this->ana->ptoLedger())->map(fn (CutOff $c) => [$c->accrued, $c->deductedHoursExact])->all();
        $this->late([])->assertSessionHasNoErrors();
        $after = collect($this->ana->fresh()->ptoLedger())->map(fn (CutOff $c) => [$c->accrued, $c->deductedHoursExact])->all();

        $this->assertSame($before, $after);
    }

    public function test_the_time_page_lists_this_periods_lates_with_pesos()
    {
        $this->late([]);
        $this->late(['date' => '2026-11-12', 'start_time' => '09:00', 'end_time' => '09:30']);

        $this->actingAs($this->ana)->get(route('time.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('time/index')
                ->has('lates', 2)
                ->where('lates.0.date', '2026-11-13')
                ->where('lates.0.minutes', 47)
                ->where('period.minutes', 77)
                // 77 min at 60,000 x 12 / 260 / 8 = 346.1538 an hour, rounded once: 444.23.
                ->where('period.pesos', 444.23)
                ->where('wip_attendance', 'https://wip.quicksilversystems.com/servers/1d2a17e2-6f7d-48b3-8b00-de9e39fd23b1/channels/a0b29c6f-4200-4817-9e2d-23b29f893cd2'));
    }
}
