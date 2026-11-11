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
 * HR keeps the holiday list. The migrations seed 2026 from Proclamation No. 1006 (18 dates).
 */
class HolidayTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->hr = User::factory()->hr()->create();
    }

    public function test_the_2026_list_is_seeded()
    {
        $this->assertSame(18, Holiday::count());
        $this->assertDatabaseHas('holidays', ['date' => '2026-08-31', 'name' => 'National Heroes Day', 'kind' => 'regular']);
        $this->assertDatabaseHas('holidays', ['date' => '2026-11-02', 'kind' => 'special']);
        $this->assertDatabaseMissing('holidays', ['date' => '2026-02-25']);
    }

    public function test_hr_lists_one_year_and_employees_cannot()
    {
        $this->actingAs($this->hr)
            ->get(route('people.holidays', ['year' => 2026]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('people/holidays')
                ->where('year', 2026)
                ->has('holidays', 18)
                ->where('holidays.0.date', '2026-01-01')
                ->where('holidays.0.leave_count', 0));

        $this->actingAs($this->hr)
            ->get(route('people.holidays', ['year' => 2027]))
            ->assertInertia(fn ($page) => $page->has('holidays', 0));

        $this->actingAs(User::factory()->create())
            ->get(route('people.holidays'))
            ->assertForbidden();
        $this->actingAs(User::factory()->create())
            ->post(route('people.holidays.store'), ['date' => '2027-01-01', 'name' => 'New Year', 'kind' => 'regular'])
            ->assertForbidden();
    }

    public function test_hr_adds_a_holiday_and_leave_on_it_is_kept_by_default()
    {
        $leave = Leave::factory()->for(User::factory()->create())->create(['date' => '2026-11-20']);

        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'regular'])
            ->assertRedirect(route('people.holidays', ['year' => 2026]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('holidays', ['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'regular']);
        $this->assertModelExists($leave);
    }

    public function test_hr_can_cancel_the_leave_on_a_new_holiday()
    {
        $leave = Leave::factory()->for(User::factory()->create())->create(['date' => '2026-11-20']);
        $other = Leave::factory()->for(User::factory()->create())->create(['date' => '2026-11-19']);

        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Eid test', 'kind' => 'special', 'cancel_leave' => true])
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($leave);
        $this->assertModelExists($other);
    }

    public function test_dates_are_unique_weekends_are_allowed_and_input_is_checked()
    {
        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2026-08-31', 'name' => 'Again', 'kind' => 'regular'])
            ->assertSessionHasErrors('date');

        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2027-01-02', 'name' => '', 'kind' => 'other'])
            ->assertSessionHasErrors(['name', 'kind']);

        $this->actingAs($this->hr)
            ->post(route('people.holidays.store'), ['date' => '2027-01-02', 'name' => 'A Saturday', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
    }

    public function test_hr_edits_and_deletes_a_holiday()
    {
        $holiday = Holiday::query()->where('date', '2026-11-02')->sole();

        $this->actingAs($this->hr)
            ->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-03', 'name' => 'All Souls (moved)', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('holidays', ['id' => $holiday->id, 'date' => '2026-11-03', 'name' => 'All Souls (moved)']);

        // Keeping its own date is not a duplicate.
        $this->actingAs($this->hr)
            ->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-03', 'name' => 'All Souls', 'kind' => 'special'])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->hr)
            ->delete(route('people.holidays.destroy', $holiday))
            ->assertRedirect();
        $this->assertModelMissing($holiday);
    }

    public function test_the_seed_rolls_back()
    {
        Artisan::call('migrate:rollback', ['--step' => 2]);
        $this->assertFalse(Schema::hasTable('holidays'));

        Artisan::call('migrate');
        $this->assertSame(18, Holiday::count());
    }
}
