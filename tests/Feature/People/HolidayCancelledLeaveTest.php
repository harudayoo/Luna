<?php

namespace Tests\Feature\People;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Leave HR cancels for a new holiday is set aside, not deleted: it comes back when the holiday is removed
 * or moved to another date. "Today" is Wed 2026-11-11; Ben has leave on Fri Nov 20.
 */
class HolidayCancelledLeaveTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ben;

    private Leave $leave;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->hr = User::factory()->hr()->create();
        $this->ben = User::factory()->create(['name' => 'Ben Reyes']);
        $this->leave = Leave::factory()->for($this->ben)->create(['date' => '2026-11-20', 'note' => 'Family trip']);
    }

    private function addHolidayCancellingLeave(): Holiday
    {
        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'special', 'cancel_leave' => true])
            ->assertSessionHasNoErrors();

        return Holiday::query()->where('date', '2026-11-20')->sole();
    }

    public function test_cancelled_leave_is_gone_from_everywhere_while_the_holiday_stands()
    {
        $this->addHolidayCancellingLeave();

        $this->assertNull(Leave::find($this->leave->id));
        $this->assertSame(0, $this->ben->leaves()->count());
        $this->actingAs($this->hr)->get(route('people.holidays', ['year' => 2026]))
            ->assertInertia(fn ($page) => $page->where('leave_dates', []));
    }

    public function test_removing_the_holiday_brings_the_leave_back()
    {
        $holiday = $this->addHolidayCancellingLeave();

        $this->actingAs($this->hr)->delete(route('people.holidays.destroy', $holiday))->assertRedirect();

        $back = Leave::find($this->leave->id);
        $this->assertNotNull($back);
        $this->assertSame(['2026-11-20', 'Family trip'], [$back->date->toDateString(), $back->note]);
        $this->assertSame(1, $this->ben->leaves()->count());
    }

    public function test_moving_the_holiday_brings_the_leave_back_on_the_old_date()
    {
        $holiday = $this->addHolidayCancellingLeave();

        $this->actingAs($this->hr)
            ->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-27', 'name' => 'Eid test', 'kind' => 'special'])
            ->assertSessionHasNoErrors();

        $this->assertNotNull(Leave::find($this->leave->id));
    }

    /** Ben files Thu Nov 19 to Mon Nov 23 while Fri Nov 20 is already a holiday. */
    private function fileOverHoliday(): Holiday
    {
        $this->leave->delete();
        $holiday = Holiday::query()->create(['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'special']);
        $this->actingAs($this->ben)
            ->post(route('leave.store'), ['from' => '2026-11-19', 'to' => '2026-11-23', 'note' => 'Family trip'])
            ->assertSessionHasNoErrors();

        return $holiday;
    }

    public function test_leave_filed_over_a_holiday_skips_that_day_while_the_holiday_stands()
    {
        $this->fileOverHoliday();

        $this->assertSame(['2026-11-19', '2026-11-23'], $this->ben->leaves()->orderBy('date')->get()->map(fn (Leave $l) => $l->date->toDateString())->all());
    }

    public function test_removing_a_holiday_brings_back_that_day_of_leave_filed_over_it()
    {
        $holiday = $this->fileOverHoliday();

        $this->actingAs($this->hr)->delete(route('people.holidays.destroy', $holiday))->assertRedirect();

        $dates = $this->ben->leaves()->orderBy('date')->get();
        $this->assertSame(['2026-11-19', '2026-11-20', '2026-11-23'], $dates->map(fn (Leave $l) => $l->date->toDateString())->all());
        $this->assertSame('Family trip', $dates[1]->note);
    }

    public function test_hr_filing_over_a_holiday_also_comes_back_when_it_is_moved()
    {
        $this->leave->delete();
        $holiday = Holiday::query()->create(['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'special']);
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ben), ['from' => '2026-11-19', 'to' => '2026-11-20'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->hr)
            ->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-27', 'name' => 'Eid test', 'kind' => 'special'])
            ->assertSessionHasNoErrors();

        $this->assertSame(['2026-11-19', '2026-11-20'], $this->ben->leaves()->orderBy('date')->get()->map(fn (Leave $l) => $l->date->toDateString())->all());
    }

    public function test_the_migration_rolls_back()
    {
        Artisan::call('migrate:rollback', ['--path' => ['database/migrations/2026_11_13_000014_add_cancelled_by_holiday_to_leaves_table.php']]);
        $this->assertFalse(Schema::hasColumn('leaves', 'cancelled_by_holiday_id'));

        Artisan::call('migrate');
        $this->assertTrue(Schema::hasColumn('leaves', 'cancelled_by_holiday_id'));
    }
}
