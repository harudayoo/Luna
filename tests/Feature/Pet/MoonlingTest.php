<?php

namespace Tests\Feature\Pet;

use App\Models\LateLog;
use App\Models\Leave;
use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The collection (spec 2026-11-25-luna-moonling-life, slice 6): moonlings as records, XP to the active one, eggs from
 * achievements (once each, with a bell notice), switching once the active one hatched, the moon nest. The streak
 * stays per person. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class MoonlingTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
    }

    /** XP straight onto a moonling (the active one by default). */
    private function xp(User $user, int $xp, ?Moonling $to = null): void
    {
        PetEvent::query()->create([
            'user_id' => $user->id, 'kind' => 'seed', 'ref' => 'seed-'.uniqid(), 'xp' => $xp,
            'moonling_id' => ($to ?? Moonlings::active($user))->id,
        ]);
    }

    private function egg(User $user, string $kind): Moonling
    {
        return Moonling::query()->create(['user_id' => $user->id, 'kind' => $kind, 'source' => $kind]);
    }

    /** @return list<string> */
    private function kinds(User $user): array
    {
        return Moonling::query()->where('user_id', $user->id)->orderBy('kind')->pluck('kind')->all();
    }

    private function eggNotices(User $user): int
    {
        return $user->notifications()->get()->filter(fn ($n) => $n->data['kind'] === 'pet_egg')->count();
    }

    /** The N office days (Mon–Fri) before today, newest first. */
    private function officeDaysBefore(int $n): array
    {
        $days = [];
        for ($d = CarbonImmutable::parse('2026-11-18'); count($days) < $n; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $days[] = $d->toDateString();
            }
        }

        return $days;
    }

    public function test_the_migration_gives_everyone_an_active_moon_moonling_with_their_name_and_xp_and_goes_down()
    {
        // `pet_name` was dropped by 000031: bring it back first, as it was when 000029 ran.
        (require database_path('migrations/2026_11_26_000031_drop_pet_name_from_users_table.php'))->down();
        $migration = require database_path('migrations/2026_11_26_000029_create_moonlings_table.php');
        DB::table('users')->where('id', $this->ana->id)->update(['pet_name' => 'Mochi']);
        $ben = User::factory()->create();

        $migration->down();
        $this->assertFalse(Schema::hasTable('moonlings'));
        $this->assertFalse(Schema::hasColumn('pet_events', 'moonling_id'));
        PetEvent::query()->insert([
            ['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => '2026-11-18', 'xp' => 5, 'created_at' => now()],
            ['user_id' => $this->ana->id, 'kind' => 'item_time', 'ref' => '3:2026-11-18', 'xp' => 10, 'created_at' => now()],
            ['user_id' => $ben->id, 'kind' => 'visit', 'ref' => '2026-11-18', 'xp' => 7, 'created_at' => now()],
        ]);

        $migration->up();

        $mine = Moonling::query()->where('user_id', $this->ana->id)->sole();
        $this->assertSame(['moon', 'Mochi', true, 'start'], [$mine->kind, $mine->name, $mine->active, $mine->source]);
        $this->assertSame(15, (int) PetEvent::query()->where('moonling_id', $mine->id)->sum('xp'));
        $bens = Moonling::query()->where('user_id', $ben->id)->sole();
        $this->assertSame([null, 7], [$bens->name, (int) PetEvent::query()->where('moonling_id', $bens->id)->sum('xp')]);
        $this->assertSame(0, PetEvent::query()->whereNull('moonling_id')->count());

        $migration->down();
        $this->assertFalse(Schema::hasTable('moonlings'));
        $this->assertFalse(Schema::hasColumn('pet_events', 'moonling_id'));
        $this->assertSame(22, (int) PetEvent::query()->sum('xp'));
        $migration->up();
    }

    public function test_a_new_person_gets_a_moon_moonling_on_their_first_visit()
    {
        $this->actingAs($this->ana)->get(route('dashboard'))->assertOk();

        $moon = Moonling::query()->where('user_id', $this->ana->id)->sole();
        $this->assertSame(['moon', true, 'start'], [$moon->kind, $moon->active, $moon->source]);
        $this->assertSame($moon->id, PetEvent::query()->where('kind', 'visit')->sole()->moonling_id);
    }

    public function test_new_xp_goes_to_the_active_moonling_and_each_keeps_its_own_stage()
    {
        $moon = Moonlings::active($this->ana);
        $this->xp($this->ana, 200);
        $star = $this->egg($this->ana, 'star');

        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $star->id])->assertSessionHasNoErrors();
        $this->assertTrue($star->fresh()->active);
        $this->assertFalse($moon->fresh()->active);

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pet.kind', 'star')->where('pet.stage', 0)->where('pet.xp', 5));

        Pet::award($this->ana, 'leave', '2026-12-01');
        $this->assertSame(10, (int) PetEvent::query()->where('moonling_id', $star->id)->sum('xp'));
        $this->assertSame(200, (int) PetEvent::query()->where('moonling_id', $moon->id)->sum('xp'));

        // The star hatches; switching back brings the moon's own stage back.
        $this->xp($this->ana, 30, $star);
        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $moon->id])->assertSessionHasNoErrors();
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pet.kind', 'moon')->where('pet.stage', 2)->where('pet.xp', 200));
    }

    public function test_switching_needs_the_active_one_hatched_and_only_to_your_own_moonling()
    {
        $moon = Moonlings::active($this->ana);
        $star = $this->egg($this->ana, 'star');

        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $star->id])->assertSessionHasErrors('moonling_id');
        $this->assertTrue($moon->fresh()->active);

        $this->xp($this->ana, 40);
        $bens = Moonlings::active(User::factory()->create());
        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $bens->id])->assertSessionHasErrors('moonling_id');
        $this->assertTrue($moon->fresh()->active);
        $this->assertTrue($bens->fresh()->active);

        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $star->id])->assertSessionHasNoErrors();
        $this->assertSame([$star->id], Moonling::query()->where('user_id', $this->ana->id)->where('active', true)->pluck('id')->all());
    }

    public function test_eggs_come_from_achievements_once_each_with_a_bell_notice()
    {
        $ben = User::factory()->create();
        // Just below every threshold.
        foreach ($this->officeDaysBefore(28) as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $d, 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        }
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => '2026-11-19', 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        foreach (range(1, 24) as $i) {
            $this->ana->items()->create(['scope' => 'personal', 'title' => "Done {$i}", 'status' => 'done']);
        }
        $this->ana->items()->create(['scope' => 'personal', 'title' => 'Not yet', 'status' => 'progress']);
        $ben->items()->create(['scope' => 'personal', 'title' => 'Not hers', 'status' => 'done']);
        foreach (array_slice($this->officeDaysBefore(19), 0, 19) as $i => $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'item_time', 'ref' => "{$i}:{$d}", 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        }
        $this->xp($this->ana, 899);

        Moonlings::checkEggs($this->ana);
        $this->assertSame(['moon'], $this->kinds($this->ana));
        $this->assertSame(0, $this->eggNotices($this->ana));

        // Over every threshold: a 30-day streak, 25 finished items, time on 20 days, a Full Moon, last week's cup.
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $this->officeDaysBefore(29)[28], 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        $this->ana->items()->create(['scope' => 'personal', 'title' => 'Done 25', 'status' => 'done']);
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'item_time', 'ref' => '99:2026-10-01', 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        $this->xp($this->ana, 1);
        PetDuel::query()->create([
            'challenger_id' => $this->ana->id, 'opponent_id' => $ben->id, 'challenger_pick' => 'moon', 'opponent_pick' => 'star',
            'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-11-11 02:00:00',
        ]);

        Moonlings::checkEggs($this->ana);
        // Five eggs and the first moonling make six, which also earns the moonflower egg (5 moonlings, slice 15).
        $this->assertSame(['aurora', 'comet', 'eclipse', 'moon', 'moonflower', 'nova', 'star'], $this->kinds($this->ana));
        $this->assertSame(1, Moonling::query()->where('user_id', $this->ana->id)->where('active', true)->count());
        $this->assertSame(6, $this->eggNotices($this->ana));
        $bodies = $this->ana->notifications()->get()->pluck('data.body')->sort()->values()->all();
        $this->assertSame([
            'A comet egg appeared in your moon nest.',
            'A moonflower egg appeared in your moon nest.',
            'A nova egg appeared in your moon nest.',
            'A star egg appeared in your moon nest.',
            'An aurora egg appeared in your moon nest.',
            'An eclipse egg appeared in your moon nest.',
        ], $bodies);
        $notice = $this->ana->notifications()->first();
        $this->assertSame(['home', route('dashboard', ['pet' => 'nest'], false)], [$notice->data['module'], $notice->data['url']]);

        Moonlings::checkEggs($this->ana);
        $this->assertCount(7, $this->kinds($this->ana));
        $this->assertSame(6, $this->eggNotices($this->ana));
    }

    public function test_attendance_leave_and_lates_never_earn_an_egg()
    {
        foreach ($this->officeDaysBefore(40) as $d) {
            Leave::factory()->for($this->ana)->create(['date' => $d]);
            LateLog::query()->forceCreate([
                'user_id' => $this->ana->id, 'date' => $d, 'kind' => 'late_in',
                'start_time' => '09:00', 'end_time' => '10:00', 'minutes' => 60,
            ]);
        }

        Moonlings::checkEggs($this->ana);

        $this->assertSame(['moon'], $this->kinds($this->ana));
        $this->assertSame(0, $this->eggNotices($this->ana));
    }

    public function test_a_new_award_checks_for_eggs()
    {
        foreach (range(1, 25) as $i) {
            $this->ana->items()->create(['scope' => 'personal', 'title' => "Done {$i}", 'status' => 'done']);
        }

        $this->actingAs($this->ana)->get(route('dashboard'));
        $this->assertSame(['comet', 'moon'], $this->kinds($this->ana));

        $this->actingAs($this->ana)->get(route('dashboard'));
        $this->assertSame(['comet', 'moon'], $this->kinds($this->ana));
    }

    public function test_the_name_belongs_to_the_active_moonling()
    {
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => 'Mochi'])->assertSessionHasNoErrors();
        $this->assertSame('Mochi', Moonlings::active($this->ana)->name);
        $this->assertNull($this->ana->fresh()->pet_name);

        $this->xp($this->ana, 40);
        $star = $this->egg($this->ana, 'star');
        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $star->id]);
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet.name', null));
    }

    public function test_the_board_and_duels_show_the_active_moonling_and_the_streak_stays_per_person()
    {
        $ben = User::factory()->create(['name' => 'Ben Reyes']);
        foreach ([$this->ana, $ben] as $u) {
            $u->forceFill(['pet_public' => true])->save();
        }
        foreach (['2026-11-17', '2026-11-18'] as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'visit', 'ref' => $d, 'xp' => 0, 'moonling_id' => Moonlings::active($this->ana)->id]);
        }
        $this->xp($this->ana, 200);
        $star = $this->egg($this->ana, 'star');
        $this->actingAs($this->ana)->patch(route('pet.active'), ['moonling_id' => $star->id]);
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => 'Kira']);
        $this->actingAs($this->ana)->post(route('pet.duels.store'), ['opponent_id' => $ben->id, 'pick' => 'moon']);

        $this->actingAs($ben)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_board', fn (AssertableInertia $reload) => $reload
                    ->where('pet_board.rows.0.first_name', 'Ana')
                    ->where('pet_board.rows.0.kind', 'star')
                    ->where('pet_board.rows.0.stage', 0)
                    ->where('pet_board.rows.0.pet_name', 'Kira')
                    ->where('pet_board.rows.0.streak', 2))
                ->reloadOnly('pet_duels', fn (AssertableInertia $reload) => $reload
                    ->where('pet_duels.incoming.0.kind', 'star')
                    ->where('pet_duels.incoming.0.stage', 0)
                    ->where('pet_duels.incoming.0.from_pet', 'Kira')));
    }

    public function test_the_nest_loads_only_when_asked_and_lists_moonlings_and_eggs()
    {
        $this->xp($this->ana, 40);
        $this->egg($this->ana, 'star');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_nest')
                ->reloadOnly('pet_nest', fn (AssertableInertia $reload) => $reload
                    ->has('pet_nest.moonlings', 2)
                    ->where('pet_nest.moonlings.0.kind', 'moon')
                    ->where('pet_nest.moonlings.0.active', true)
                    ->where('pet_nest.moonlings.0.stage', 1)
                    ->where('pet_nest.moonlings.1.kind', 'star')
                    ->where('pet_nest.moonlings.1.active', false)
                    ->where('pet_nest.moonlings.1.stage', 0)
                    ->hasAll(['pet_nest.moonlings.1.id', 'pet_nest.moonlings.1.name', 'pet_nest.moonlings.1.stage_name'])
                    ->where('pet_nest.can_switch', true)
                    ->has('pet_nest.eggs', 12)
                    ->where('pet_nest.eggs.0.kind', 'star')
                    ->where('pet_nest.eggs.0.earned', true)
                    ->where('pet_nest.eggs.1.earned', false)
                    ->has('pet_nest.eggs.1.how')));
    }

    public function test_an_egg_notice_opens_the_nest_once()
    {
        $this->actingAs($this->ana)->get(route('dashboard', ['pet' => 'nest']))
            ->assertRedirect(route('dashboard'));
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', 'nest'));
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', null));
    }
}
