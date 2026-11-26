<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use App\Services\Pet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What the moonling can talk about on Home (spec 2026-11-25-luna-moonling-life, slice 8): `today` gains payday, the
 * eve of a day off, the weekday and the part of the office day. All on the office clock (Manila).
 */
class PetVoiceCueTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz']);
    }

    private function today(): array
    {
        return Pet::state($this->ana->fresh())['today'];
    }

    public function test_the_part_of_the_day_and_the_weekday_follow_the_office_clock()
    {
        $this->travelTo('2026-11-16 01:00:00'); // Mon 09:00 Manila
        $this->assertSame(['morning', 1], [$this->today()['part'], $this->today()['weekday']]);

        $this->travelTo('2026-11-20 04:30:00'); // Fri 12:30 Manila
        $this->assertSame(['afternoon', 5], [$this->today()['part'], $this->today()['weekday']]);

        $this->travelTo('2026-11-20 07:00:00'); // Fri 15:00 Manila
        $this->assertSame('evening', $this->today()['part']);

        $this->travelTo('2026-11-19 17:00:00'); // Thu 17:00 UTC = Fri 01:00 Manila
        $this->assertSame(['morning', 5], [$this->today()['part'], $this->today()['weekday']]);
    }

    public function test_payday_is_a_payslip_of_yours_released_today()
    {
        $this->travelTo('2026-11-30 02:00:00');
        $this->assertFalse($this->today()['payday']);

        $inputs = array_fill_keys(Payslip::INPUTS, 0);
        $slip = Payslip::create($inputs + PayslipMath::totals(60000, 2727.27, $inputs) + [
            'user_id' => $this->ana->id, 'period_start' => '2026-11-01', 'period_end' => '2026-11-15', 'issued_on' => '2026-11-15',
            'position' => 'Developer', 'monthly_salary' => 60000, 'daily_rate' => 2727.27, 'released_on' => '2026-11-29',
        ]);
        $this->assertFalse($this->today()['payday']);

        $slip->update(['released_on' => '2026-11-30']);
        $this->assertTrue($this->today()['payday']);

        $other = User::factory()->create();
        $slip->update(['user_id' => $other->id]);
        $this->assertFalse($this->today()['payday']);
    }

    public function test_the_eve_of_a_holiday_or_your_own_leave_skipping_the_weekend()
    {
        $this->travelTo('2026-11-19 02:00:00'); // Thu
        $this->assertFalse($this->today()['day_off_tomorrow']);

        Leave::factory()->create(['user_id' => $this->ana->id, 'date' => '2026-11-20']);
        $this->assertTrue($this->today()['day_off_tomorrow']);

        // Friday, with Monday a holiday.
        $this->travelTo('2026-11-20 02:00:00');
        $this->assertFalse($this->today()['day_off_tomorrow']);
        Holiday::query()->create(['date' => '2026-11-23', 'name' => 'Day off', 'kind' => 'regular']);
        $this->assertTrue($this->today()['day_off_tomorrow']);
    }
}
