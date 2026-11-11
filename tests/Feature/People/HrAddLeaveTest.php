<?php

namespace Tests\Feature\People;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * HR logs leave for someone else, including in cut-offs that have ended (to fix the record).
 * "Today" is Wed 2026-11-11; Oct 16-31 has ended. Nov 30 is a seeded holiday.
 */
class HrAddLeaveTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-09-01']);
    }

    public function test_hr_adds_leave_in_an_ended_cut_off()
    {
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-09-25', 'note' => 'Missed'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('people.leave', ['cutoff' => '2026-09-16']));

        $this->assertDatabaseHas('leaves', ['user_id' => $this->ana->id, 'date' => '2026-09-25', 'days' => 1, 'note' => 'Missed']);
        $this->assertSame(0, $this->hr->leaves()->count());
    }

    public function test_a_range_and_a_half_day()
    {
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-11-27', 'to' => '2026-12-01'])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-10-20', 'half_day' => true])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            [['2026-10-20', 0.5], ['2026-11-27', 1.0], ['2026-12-01', 1.0]],
            $this->ana->leaves()->orderBy('date')->get()->map(fn (Leave $l) => [$l->date->toDateString(), (float) $l->days])->all(),
        );
    }

    public function test_employees_cannot_add_leave_for_others()
    {
        $this->actingAs(User::factory()->create())
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-11-12'])
            ->assertForbidden();

        $this->assertSame(0, Leave::count());
    }

    public function test_the_usual_rules_still_apply_and_name_the_person()
    {
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-08-28'])
            ->assertSessionHasErrors(['from' => 'Ana’s PTO starts on Sep 1, 2026.']);

        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-11-30'])
            ->assertSessionHasErrors(['from' => 'Nov 30 is Bonifacio Day.']);

        Leave::factory()->for($this->ana)->create(['date' => '2026-10-21']);
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-10-21'])
            ->assertSessionHasErrors(['from' => 'Ana already logged leave on Oct 21.']);

        foreach (['01', '02', '05', '06', '07', '08', '09', '12', '13'] as $d) {
            Leave::factory()->for($this->ana)->create(['date' => "2026-10-$d"]);
        }
        // 10 days in October with Oct 21: one more is over the cap.
        $this->actingAs($this->hr)
            ->post(route('people.leave.store', $this->ana), ['from' => '2026-10-22'])
            ->assertSessionHasErrors('from');
    }
}
