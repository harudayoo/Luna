<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\LateLog;
use App\Models\Leave;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Inertia;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Mood and voice (spec 2026-11-25-luna-moonling-life, slice 5): mood over the last 5 office days before today
 * (weekends, holidays and own leave skipped; days before the first visit too, so new people start glowing):
 * 100, −20 for each day without a visit, +10 for today's pat, kept within 0–100. Lates never count. Private to the
 * owner. "Now" is Thu 2026-11-19 10:00 Manila; the 5 office days before it are Thu 12, Fri 13, Mon 16, Tue 17, Wed 18.
 */
class PetMoodTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->visits($this->ana, ['2026-11-02']); // her first visit, long before the window
    }

    private function visits(User $user, array $dates): void
    {
        foreach ($dates as $date) {
            PetEvent::query()->create(['user_id' => $user->id, 'kind' => 'visit', 'ref' => $date, 'xp' => 5]);
        }
    }

    /** @return array{score: int, level: string, patted: bool} */
    private function mood(): array
    {
        return Pet::state($this->ana->fresh())['mood'];
    }

    private function pat(): void
    {
        $this->actingAs($this->ana)->post(route('pet.pat'))->assertSessionHasNoErrors();
    }

    public function test_mood_follows_the_formula_at_its_edges()
    {
        $this->assertSame(['score' => 0, 'level' => 'gloomy', 'patted' => false], $this->mood());

        $this->pat();
        $this->assertSame(['score' => 10, 'level' => 'gloomy', 'patted' => true], $this->mood());

        $this->visits($this->ana, ['2026-11-12']);
        $this->assertSame([30, 'droopy'], [$this->mood()['score'], $this->mood()['level']]);

        $this->visits($this->ana, ['2026-11-13']);
        $this->assertSame([50, 'okay'], [$this->mood()['score'], $this->mood()['level']]);

        $this->visits($this->ana, ['2026-11-16']);
        $this->assertSame([70, 'happy'], [$this->mood()['score'], $this->mood()['level']]);

        $this->visits($this->ana, ['2026-11-17']);
        $this->assertSame([90, 'glowing'], [$this->mood()['score'], $this->mood()['level']]);

        $this->visits($this->ana, ['2026-11-18']);
        $this->assertSame([100, 'glowing'], [$this->mood()['score'], $this->mood()['level']]); // capped
    }

    public function test_the_levels_without_a_pat()
    {
        $this->visits($this->ana, ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17']);
        $this->assertSame([80, 'happy'], [$this->mood()['score'], $this->mood()['level']]);

        PetEvent::query()->where('ref', '2026-11-17')->delete();
        $this->assertSame([60, 'okay'], [$this->mood()['score'], $this->mood()['level']]);

        PetEvent::query()->where('ref', '2026-11-16')->delete();
        $this->assertSame([40, 'droopy'], [$this->mood()['score'], $this->mood()['level']]);

        PetEvent::query()->where('ref', '2026-11-13')->delete();
        $this->assertSame([20, 'droopy'], [$this->mood()['score'], $this->mood()['level']]);
    }

    public function test_a_new_person_starts_glowing()
    {
        $new = User::factory()->create();

        $this->assertSame(['score' => 100, 'level' => 'glowing', 'patted' => false], Pet::state($new)['mood']);
        $this->assertSame(0, Pet::state($new)['days_away']);
    }

    public function test_weekends_holidays_own_leave_and_lates_never_lower_mood()
    {
        Holiday::query()->create(['date' => '2026-11-18', 'name' => 'Holiday', 'kind' => 'special']);
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-17']);
        // So the 5 office days counted are Mon 16, Fri 13, Thu 12, Wed 11, Tue 10.
        $this->visits($this->ana, ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16']);
        foreach (['late_in', 'lunch', 'early_out', 'errand'] as $i => $kind) {
            LateLog::query()->forceCreate([
                'user_id' => $this->ana->id, 'date' => '2026-11-1'.(3 + min($i, 3)), 'kind' => $kind,
                'start_time' => '09:00', 'end_time' => '10:00', 'minutes' => 60,
            ]);
        }

        $this->assertSame(['score' => 100, 'level' => 'glowing', 'patted' => false], $this->mood());
    }

    public function test_a_pat_counts_once_an_office_day_and_gives_no_xp()
    {
        $xp = Pet::state($this->ana)['xp'];

        $this->pat();
        $this->pat();

        $this->assertSame(1, PetEvent::query()->where('kind', 'pat')->count());
        $this->assertSame(['2026-11-19', 0], PetEvent::query()->where('kind', 'pat')->get(['ref', 'xp'])
            ->map(fn ($e) => [$e->ref, (int) $e->xp])->sole());
        $this->assertSame($xp, Pet::state($this->ana->fresh())['xp']);
        $this->assertTrue($this->mood()['patted']);

        // Pats stay out of the XP list.
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                ->where('pet_detail.recent', fn ($recent) => collect($recent)->every(fn ($r) => $r['xp'] > 0))));

        // A new office day: not patted yet.
        $this->travelTo('2026-11-20 02:00:00');
        $this->assertFalse($this->mood()['patted']);
        $this->pat();
        $this->assertSame(2, PetEvent::query()->where('kind', 'pat')->count());
    }

    public function test_mood_is_only_in_the_owners_pet_prop()
    {
        $ben = User::factory()->create(['name' => 'Ben Reyes']);
        foreach ([$this->ana, $ben] as $u) {
            $u->forceFill(['pet_public' => true])->save();
        }
        $this->actingAs($ben)->post(route('pet.duels.store'), ['opponent_id' => $this->ana->id, 'pick' => 'moon']);
        $this->actingAs($this->ana)->post(route('pet.duels.answer', PetDuel::query()->sole()), ['pick' => 'star']);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('pet.mood')->has('pet.days_away'));

        foreach (['pet_board', 'pet_duels'] as $prop) {
            $json = json_encode($this->actingAs($ben)->get(route('dashboard'), [
                'X-Inertia' => 'true', 'X-Inertia-Partial-Component' => 'dashboard', 'X-Inertia-Partial-Data' => $prop,
                'X-Inertia-Version' => Inertia::getVersion(),
            ])->assertOk()->json("props.{$prop}"));
            $this->assertStringNotContainsString('mood', $json, $prop);
            $this->assertStringNotContainsString('days_away', $json, $prop);
        }

        $notices = json_encode([$this->ana->notifications()->pluck('data'), $ben->notifications()->pluck('data')]);
        $this->assertStringNotContainsString('mood', $notices);
    }

    public function test_days_away_counts_office_days_missed_before_today()
    {
        Leave::factory()->for($this->ana)->create(['date' => '2026-11-17']);
        $this->visits($this->ana, ['2026-11-12', '2026-11-13']);

        // Missed Mon 16 and Wed 18 (Tue 17 is leave, the weekend never counts).
        $this->assertSame(2, Pet::state($this->ana->fresh())['days_away']);

        $this->visits($this->ana, ['2026-11-18']);
        $this->assertSame(0, Pet::state($this->ana->fresh())['days_away']);
    }

    public function test_todays_news_for_the_voice_lines()
    {
        // Leave filed yesterday (Wed 10:00 Manila) is old news.
        $this->travelTo('2026-11-18 02:00:00');
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'leave', 'ref' => '2026-11-30', 'xp' => 5]);
        $this->travelTo('2026-11-19 02:00:00');
        $this->assertSame(['time_logged' => false, 'leave_filed' => false, 'duel_waiting' => false], array_intersect_key(Pet::state($this->ana)['today'], array_flip(['time_logged', 'leave_filed', 'duel_waiting'])));

        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'item_time', 'ref' => '7:2026-11-19', 'xp' => 10]);
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'leave', 'ref' => '2026-11-27', 'xp' => 5]);
        $ben = User::factory()->create();
        PetDuel::query()->create(['challenger_id' => $ben->id, 'opponent_id' => $this->ana->id, 'challenger_pick' => 'moon', 'status' => 'open']);

        $this->assertSame(['time_logged' => true, 'leave_filed' => true, 'duel_waiting' => true], array_intersect_key(Pet::state($this->ana)['today'], array_flip(['time_logged', 'leave_filed', 'duel_waiting'])));
    }

    public function test_patting_needs_a_sign_in()
    {
        $this->post(route('pet.pat'))->assertRedirect(route('login'));
        $this->assertSame(0, PetEvent::query()->where('kind', 'pat')->count());
    }
}
