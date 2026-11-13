<?php

namespace Tests\Feature\Time;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Time and lates are for everyone: employees, HR and admins all stamp their own day and declare their own
 * lates (the user, 2026-11-13). "Today" is Fri 2026-11-13, 9:15 office time.
 */
class AllRolesTimeTest extends TestCase
{
    use RefreshDatabase;

    public static function roles(): array
    {
        return ['employee' => ['employee'], 'hr' => ['hr'], 'admin' => ['admin']];
    }

    #[DataProvider('roles')]
    public function test_every_role_stamps_and_logs_their_own_late(string $role)
    {
        $this->travelTo('2026-11-13 01:15:00');
        $factory = $role === 'employee' ? User::factory() : User::factory()->{$role}();
        $user = $factory->create(['pto_start' => '2026-10-01']);

        $this->actingAs($user)->get(route('time.index'))->assertOk();
        $this->actingAs($user)->get(route('dashboard'))->assertOk()
            ->assertInertia(fn ($page) => $page->where('today.next', 'time_in'));

        $this->actingAs($user)->post(route('time.stamp'), ['step' => 'time_in'])->assertSessionHasNoErrors();
        $this->actingAs($user)->post(route('time.lates.store'), [
            'date' => '2026-11-13', 'kind' => 'late_in', 'start_time' => '09:00', 'end_time' => '09:15', 'note' => '',
        ])->assertSessionHasNoErrors();

        $this->assertSame('09:15', $user->timeLogs()->first()->time_in);
        $this->assertSame(15, $user->lateLogs()->first()->minutes);
    }
}
