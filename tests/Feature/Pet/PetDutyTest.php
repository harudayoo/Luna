<?php

namespace Tests\Feature\Pet;

use App\Models\Holiday;
use App\Models\Moonling;
use App\Models\Payslip;
use App\Models\PetEvent;
use App\Models\Setting;
use App\Models\User;
use Inertia\Testing\AssertableInertia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * XP for HR and admin work (spec 2026-11-26-luna-moonling-style, slice 11): 10 XP once per area (payroll, people,
 * calendar) per office day, ref `{area}:{office date}`, only for successful saves; deletes and undoing a release pay
 * nothing. Office days with duty XP count toward the aurora egg. "Now" is Thu 2026-11-12 10:00 Manila.
 */
class PetDutyTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-12 02:00:00');
        Setting::put('pto.accrual_mode', 'full');
        $this->hr = User::factory()->hr()->create(['name' => 'Hana Reyes']);
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-11-01']);
        $this->ana->forceFill(['monthly_salary' => 60000, 'position' => 'Developer'])->save();
    }

    /** @return array<string, int> duty refs and their XP for a person */
    private function duties(User $u): array
    {
        return PetEvent::query()->where('user_id', $u->id)->where('kind', 'duty')->orderBy('ref')->pluck('xp', 'ref')
            ->map(fn ($xp) => (int) $xp)->all();
    }

    private function payslip(): array
    {
        return [
            'issued_on' => '2026-11-30', 'holiday_regular_days' => 0, 'holiday_special_days' => 0, 'absences' => 0,
            'overtime_allowance' => 0, 'sss' => 0, 'philhealth' => 0, 'pagibig' => 0, 'withholding_tax' => 0, 'cash_advance' => 0,
        ];
    }

    public function test_payroll_work_pays_10_xp_once_an_office_day()
    {
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payslip())->assertSessionHasNoErrors();
        $slip = Payslip::query()->sole();
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $slip), ['released' => true])->assertSessionHasNoErrors();
        $this->assertSame(['payroll:2026-11-12' => 10], $this->duties($this->hr));

        // The next office day, releasing a whole cut-off pays again.
        $this->travelTo('2026-11-13 02:00:00');
        $this->actingAs($this->hr)->patch(route('people.payroll.release', $slip), ['released' => false])->assertSessionHasNoErrors();
        $this->assertSame(['payroll:2026-11-12' => 10], $this->duties($this->hr), 'undoing a release pays nothing');
        $this->actingAs($this->hr)->post(route('people.payroll.release.all'), ['cutoff' => '2026-11-01'])->assertSessionHasNoErrors();
        $this->assertSame(['payroll:2026-11-12' => 10, 'payroll:2026-11-13' => 10], $this->duties($this->hr));
    }

    public function test_people_work_pays_once_a_day_across_its_actions()
    {
        $this->actingAs($this->hr)->post(route('people.store'), ['name' => 'Ben Reyes', 'email' => 'ben@example.com', 'role' => 'employee'])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->put(route('people.time.update', [$this->ana, '2026-11-12']), [
            'time_in' => '08:55', 'lunch_start' => '12:00', 'lunch_end' => '13:00', 'time_out' => null,
        ])->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->post(route('people.leave.store', $this->ana), ['from' => '2026-11-20'])->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->patch(route('people.update', $this->ana), ['monthly_salary' => 61000, 'pto_opening_hours' => 0])
            ->assertSessionHasNoErrors();

        $this->assertSame(['people:2026-11-12' => 10], $this->duties($this->hr));
    }

    public function test_calendar_work_pays_and_the_three_areas_add_up_to_30()
    {
        $this->actingAs($this->hr)->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Office day off', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
        $holiday = Holiday::query()->where('name', 'Office day off')->sole();
        $this->actingAs($this->hr)->patch(route('people.holidays.update', $holiday), ['date' => '2026-11-27', 'name' => 'Office day off', 'kind' => 'special'])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payslip())->assertSessionHasNoErrors();
        $this->actingAs($this->hr)->post(route('people.store'), ['name' => 'Ben Reyes', 'email' => 'ben@example.com', 'role' => 'employee']);

        $this->assertSame(['calendar:2026-11-12' => 10, 'payroll:2026-11-12' => 10, 'people:2026-11-12' => 10], $this->duties($this->hr));
        // It's moonling XP like any other: on the active moonling.
        $this->assertSame(30, (int) PetEvent::query()->where('moonling_id', Moonling::query()->where('user_id', $this->hr->id)->value('id'))->sum('xp'));
    }

    public function test_failed_saves_and_deletes_pay_nothing()
    {
        $this->actingAs($this->hr)->post(route('people.holidays.store'), ['date' => 'not a date', 'name' => '', 'kind' => 'special'])
            ->assertSessionHasErrors();
        $this->actingAs($this->hr)->post(route('people.store'), ['name' => '', 'email' => 'nope', 'role' => 'employee'])
            ->assertSessionHasErrors();
        $holiday = Holiday::query()->create(['date' => '2026-11-20', 'name' => 'Old', 'kind' => 'special']);
        $this->actingAs($this->hr)->delete(route('people.holidays.destroy', $holiday));

        $this->assertSame([], $this->duties($this->hr));
    }

    public function test_an_employee_never_gets_duty_xp()
    {
        $this->actingAs($this->ana)->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Mine', 'kind' => 'special'])
            ->assertForbidden();
        $this->actingAs($this->ana)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payslip())->assertForbidden();

        $this->assertSame([], $this->duties($this->ana));
    }

    public function test_duty_days_count_toward_the_aurora_egg()
    {
        // 19 office days with item time or duty before, then today's duty: 20 days of work.
        $days = [];
        for ($d = \Carbon\CarbonImmutable::parse('2026-11-11'); count($days) < 19; $d = $d->subDay()) {
            if (! $d->isWeekend()) {
                $days[] = $d->toDateString();
            }
        }
        foreach ($days as $i => $d) {
            PetEvent::query()->create($i % 2
                ? ['user_id' => $this->hr->id, 'kind' => 'item_time', 'ref' => "7:{$d}", 'xp' => 0]
                : ['user_id' => $this->hr->id, 'kind' => 'duty', 'ref' => "people:{$d}", 'xp' => 0]);
        }
        $this->assertFalse(Moonling::query()->where('user_id', $this->hr->id)->where('kind', 'aurora')->exists());

        $this->actingAs($this->hr)->post(route('people.holidays.store'), ['date' => '2026-11-20', 'name' => 'Office day off', 'kind' => 'special']);
        $this->assertTrue(Moonling::query()->where('user_id', $this->hr->id)->where('kind', 'aurora')->exists());
    }

    public function test_hr_sees_the_duty_line_and_the_recent_label_employees_dont()
    {
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), $this->payslip());

        $this->actingAs($this->hr)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload
                    ->where('pet_detail.duty_xp', 10)
                    ->where('pet_detail.recent', fn ($recent) => collect($recent)->contains(fn ($r) => $r['label'] === 'Payroll work' && $r['xp'] === 10))));

        $this->actingAs($this->ana)->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->reloadOnly('pet_detail', fn (AssertableInertia $reload) => $reload->where('pet_detail.duty_xp', null)));
    }
}
