<?php

namespace Tests\Feature\Pet;

use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Unlock notices (spec 2026-11-26-luna-moonling-style, slice 13): one bell notice per check that unlocks shades or
 * items, naming them all, linking to the panel's "Your pet" tab. "Now" is Thu 2026-11-19 10:00 Manila.
 */
class UnlockNoticeTest extends TestCase
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

    private function wins(int $n): void
    {
        foreach (range(1, $n) as $ignored) {
            PetDuel::query()->create([
                'challenger_id' => $this->ana->id, 'opponent_id' => $this->foe->id, 'challenger_pick' => 'moon',
                'opponent_pick' => 'star', 'winner_id' => $this->ana->id, 'status' => 'done', 'answered_at' => '2026-09-01 02:00:00',
            ]);
        }
    }

    private function check(): void
    {
        static $n = 0;
        Pet::award($this->ana, 'leave', '2027-04-'.str_pad((string) ++$n, 2, '0', STR_PAD_LEFT), 0);
    }

    /** @return \Illuminate\Support\Collection<int, \Illuminate\Notifications\DatabaseNotification> */
    private function notices()
    {
        return $this->ana->fresh()->notifications()->get()->where('data.kind', 'pet_unlock')->values();
    }

    public function test_one_notice_names_everything_that_unlocked_together()
    {
        // 10 wins at once: the wand (1), the star clip (5), the kite (10, slice 16) and the Frost shade (10).
        $this->wins(10);
        $this->check();

        $this->assertCount(1, $this->notices());
        $notice = $this->notices()->first();
        $this->assertSame('New in your wardrobe', $notice->data['title']);
        $this->assertSame('home', $notice->data['module']);
        $this->assertSame(route('dashboard', ['pet' => 'pet'], false), $notice->data['url']);
        $this->assertSame('The Star clip, the Wand, the Kite and the Frost shade are ready to wear.', $notice->data['body']);
    }

    public function test_one_unlock_reads_simply_and_nothing_new_sends_nothing()
    {
        $this->actingAs($this->ana)->patch(route('pet.update'), ['name' => 'Mochi']);
        $this->assertSame(['The Bow is ready to wear.'], $this->notices()->pluck('data.body')->all());

        // Nothing new: no second notice.
        $this->check();
        $this->assertCount(1, $this->notices());
        // Quest dyes keep their own notice.
        $this->assertTrue($this->ana->fresh()->notifications()->get()->contains('data.kind', 'pet_quest'));
    }

    public function test_the_link_opens_the_panel_on_your_pet()
    {
        $this->actingAs($this->ana)->get('/dashboard?pet=pet')->assertRedirect(route('dashboard'));
        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('pet_open', 'pet'));
    }

    public function test_a_shade_alone_is_named_as_a_shade()
    {
        foreach (['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-13', '2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09', '2026-11-06'] as $d) {
            PetEvent::query()->create(['user_id' => $this->ana->id, 'kind' => 'pat', 'ref' => $d, 'xp' => 0]);
        }
        Pet::pat($this->ana); // the 10th pat day: Sakura (and the Say hi quest, which has its own notice)

        $this->assertSame(['The Sakura shade is ready to wear.'], $this->notices()->pluck('data.body')->all());
    }
}
