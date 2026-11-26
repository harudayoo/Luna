<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Moonlings;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Moon quests (spec 2026-11-26-luna-moonling-style, slice 12): one-time goals that pay item dyes, from what Luna
 * already records, reachable in every role; two seasonal dyes from the holiday calendar and December. A finished
 * quest is recorded once (its dye's `dye:{key}` unlock) with a bell notice. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class MoonQuestTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $foe;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-19 02:00:00');
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
        $this->foe = User::factory()->create(['name' => 'Foe Lim']);
    }

    /** @return list<string> Ana's unlocked dyes */
    private function dyes(): array
    {
        return PetEvent::query()->where('user_id', $this->ana->id)->where('kind', 'unlock')
            ->where('ref', 'like', 'dye:%')->orderBy('ref')->pluck('ref')->map(fn ($r) => substr($r, 4))->all();
    }

    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-03-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    private function row(string $kind, string $ref): void
    {
        PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => $kind, 'ref' => $ref, 'xp' => 0]);
    }

    public function test_say_hi_pays_leaf_for_pats_on_three_days_of_one_week_with_a_bell_notice()
    {
        $this->row('pat', '2026-11-16');
        $this->row('pat', '2026-11-17');
        $this->check();
        $this->assertNotContains('leaf', $this->dyes());

        Pet::pat($this->ana); // Thursday: the third day this week
        $this->assertContains('leaf', $this->dyes());
        $notice = $this->ana->fresh()->notifications()->get()->firstWhere('data.kind', 'pet_quest');
        $this->assertNotNull($notice);
        $this->assertStringContainsString('Leaf', $notice->data['body']);

        // Once: no second notice.
        $this->check();
        $this->assertSame(1, $this->ana->fresh()->notifications()->get()->where('data.kind', 'pet_quest')->count());
    }

    public function test_full_week_pays_sky_for_every_office_day_of_a_week()
    {
        foreach (['2026-11-16', '2026-11-17', '2026-11-18'] as $d) {
            $this->row('visit', $d);
        }
        Pet::visit($this->ana); // Thursday: Friday still ahead
        $this->assertNotContains('sky', $this->dyes());

        $this->travelTo('2026-11-20 02:00:00');
        Pet::visit($this->ana);
        $this->assertContains('sky', $this->dyes());
    }

    public function test_a_holiday_or_own_leave_day_is_left_out_of_the_full_week()
    {
        Holiday::query()->create(['date' => '2026-11-20', 'name' => 'Day off', 'kind' => 'special']);
        foreach (['2026-11-16', '2026-11-17', '2026-11-18'] as $d) {
            $this->row('visit', $d);
        }
        Pet::visit($this->ana); // Thursday is the week's last office day
        $this->assertContains('sky', $this->dyes());
    }

    public function test_first_duel_name_day_nest_builder_and_shine()
    {
        // A finished duel, lost: ruby.
        PetDuel::query()->create([
            'challenger_id' => $this->foe->id, 'opponent_id' => $this->ana->id, 'challenger_pick' => 'moon',
            'opponent_pick' => 'star', 'winner_id' => $this->foe->id, 'status' => 'done', 'answered_at' => '2026-11-18 02:00:00',
        ]);
        $this->check();
        $this->assertSame(['ruby'], $this->dyes());

        // Naming: rose.
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => 'Mochi']);
        $this->assertSame(['rose', 'ruby'], $this->dyes());

        // A second moonling: night.
        Moonling::query()->create(['user_id' => $this->ana->id, 'kind' => 'star', 'source' => 'star']);
        $this->check();
        $this->assertSame(['night', 'rose', 'ruby'], $this->dyes());

        // A Full Moon: starlight.
        PetEvent::query()->create(['user_id' => $this->ana->id, 'moonling_id' => Moonlings::active($this->ana)->id, 'kind' => 'leave', 'ref' => 'x', 'xp' => Pet::STAGES[4]]);
        $this->check();
        $this->assertSame(['night', 'rose', 'ruby', 'starlight'], $this->dyes());
    }

    public function test_fiesta_is_seasonal_a_visit_on_the_office_day_before_a_holiday()
    {
        Pet::visit($this->ana); // no holiday ahead
        $this->assertNotContains('fiesta', $this->dyes());

        // Monday the 23rd is a holiday: Friday the 20th is the office day before it.
        Holiday::query()->create(['date' => '2026-11-23', 'name' => 'Day off', 'kind' => 'regular']);
        $this->travelTo('2026-11-20 02:00:00');
        Pet::visit($this->ana);
        $this->assertContains('fiesta', $this->dyes());
    }

    public function test_parol_is_seasonal_a_visit_in_december()
    {
        Pet::visit($this->ana);
        $this->assertNotContains('parol', $this->dyes());

        $this->travelTo('2026-12-01 02:00:00');
        Pet::visit($this->ana);
        $this->assertContains('parol', $this->dyes());
    }

    public function test_the_quests_tab_lists_each_quest_with_progress_and_its_dye()
    {
        $this->row('pat', '2026-11-16');
        $this->row('pat', '2026-11-17');

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('pet_quests')
                ->reloadOnly('pet_quests', fn (AssertableInertia $reload) => $reload
                    ->where('pet_quests', fn ($quests) => collect($quests)->pluck('key')->all() === [
                        'say_hi', 'full_week', 'first_duel', 'name_day', 'nest_builder', 'shine',
                        // Slice 18: more one-time quests.
                        'social', 'full_outfit', 'patter', 'mondays',
                        'fiesta', 'parol',
                        // Slice 17: holiday dyes.
                        'pumpkin', 'pine', 'heart',
                    ])
                    ->where('pet_quests.0.title', 'Say hi')
                    ->where('pet_quests.0.progress', 2)
                    ->where('pet_quests.0.target', 3)
                    ->where('pet_quests.0.done', false)
                    ->where('pet_quests.0.dye', 'leaf')
                    ->where('pet_quests.0.seasonal', false)
                    ->has('pet_quests.0.goal')
                    ->where('pet_quests.10.seasonal', true)));

        // A bell notice links straight to the tab.
        $this->actingAs($this->ana)->get('/dashboard?pet=quests')->assertRedirect(route('dashboard'));
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', 'quests'));
    }

    public function test_items_have_their_own_colour_so_default_is_open_and_match_is_gone()
    {
        $moon = Moonlings::active($this->ana);
        $patch = fn (array $dyes) => $this->actingAs($this->ana)->patch(route('pet.moonlings.update', $moon), ['dyes' => $dyes]);

        $patch(['balloon' => 'default'])->assertSessionHasNoErrors();
        $patch(['balloon' => 'sun'])->assertSessionHasNoErrors();
        $patch(['balloon' => 'match'])->assertSessionHasErrors('dyes');
        $patch(['balloon' => 'leaf'])->assertSessionHasErrors('dyes');
        $this->assertSame(['balloon' => 'sun'], $moon->fresh()->dyes);
    }
}
