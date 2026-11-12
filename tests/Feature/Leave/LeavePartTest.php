<?php

namespace Tests\Feature\Leave;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Half days are a morning (AM, 9-12 = 3 h) or an afternoon (PM, 1-6 = 5 h), charged their real hours of an
 * 8-hour day (user, 2026-11-12), and can cover a range. "Today" is Wed 2026-11-11.
 */
class LeavePartTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-11 09:00:00');
        $this->me = User::factory()->create(['pto_start' => '2026-10-01']);
    }

    /** @return list<array{0: string, 1: float, 2: string|null}> */
    private function logged(): array
    {
        return Leave::orderBy('date')->get()->map(fn (Leave $l) => [$l->date->toDateString(), (float) $l->days, $l->part])->all();
    }

    public function test_a_morning_off()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12', 'part' => 'am'])
            ->assertSessionHasNoErrors();

        $this->assertSame([['2026-11-12', 0.375, 'am']], $this->logged());
    }

    public function test_afternoons_across_a_range()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12', 'to' => '2026-11-16', 'part' => 'pm'])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            [['2026-11-12', 0.625, 'pm'], ['2026-11-13', 0.625, 'pm'], ['2026-11-16', 0.625, 'pm']],
            $this->logged(),
        );
    }

    public function test_full_days_by_default_and_bad_parts_refused()
    {
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-12'])
            ->assertSessionHasNoErrors();
        $this->assertSame([['2026-11-12', 1.0, null]], $this->logged());

        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-11-13', 'part' => 'evening'])
            ->assertSessionHasErrors('part');
    }

    public function test_the_cap_counts_halves_by_their_hours()
    {
        foreach (['01', '02', '03', '04', '07', '09', '10', '11', '14'] as $d) {
            Leave::factory()->for($this->me)->create(['date' => "2026-12-$d"]);
        }

        // 9 days + two afternoons (2 x 5 h = 1.25 days) = 10.25: over the cap of 10.
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-15', 'to' => '2026-12-16', 'part' => 'pm'])
            ->assertSessionHasErrors('from');

        // 9 days + two mornings (2 x 3 h = 0.75 day) = 9.75: allowed.
        $this->actingAs($this->me)
            ->post(route('leave.store'), ['from' => '2026-12-15', 'to' => '2026-12-16', 'part' => 'am'])
            ->assertSessionHasNoErrors();
    }

    public function test_hr_logs_a_morning_for_someone()
    {
        $ana = User::factory()->create(['pto_start' => '2026-10-01']);

        $this->actingAs(User::factory()->hr()->create())
            ->post(route('people.leave.store', $ana), ['from' => '2026-10-20', 'part' => 'am'])
            ->assertSessionHasNoErrors();

        $this->assertSame([['2026-10-20', 0.375, 'am']], $this->logged());
    }

    public function test_the_part_is_shown_everywhere()
    {
        Leave::factory()->for($this->me)->create(['date' => '2026-11-12', 'days' => 0.5, 'part' => 'pm']);

        $this->actingAs($this->me)->get(route('leave.index'))
            ->assertInertia(fn ($page) => $page->where('leaves.0.part', 'pm'));
        $this->actingAs($this->me)->get(route('calendar.index'))
            ->assertInertia(fn ($page) => $page->where('leaves.0.part', 'pm'));
        $this->actingAs(User::factory()->hr()->create())->get(route('people.leave'))
            ->assertInertia(fn ($page) => $page->where('rows.0.leaves.0.part', 'pm'));
    }
}
