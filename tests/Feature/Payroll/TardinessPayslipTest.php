<?php

namespace Tests\Feature\Payroll;

use App\Models\LateLog;
use App\Models\Payslip;
use App\Models\User;
use App\Services\Payroll\PayslipMath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Tardiness on the payslip: its own line, prefilled from the period's declared lates at the accountant's
 * hourly rate (monthly x 12 / 260 / 8), exact hours rounded once. Ana earns 60,000 (346.1538 an hour), paid
 * monthly; she declared 47 + 30 minutes in November and 20 in October.
 */
class TardinessPayslipTest extends TestCase
{
    use RefreshDatabase;

    private User $hr;

    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-13 01:15:00');
        $this->hr = User::factory()->hr()->create();
        $this->ana = User::factory()->create(['name' => 'Ana Cruz', 'pto_start' => '2026-10-01']);
        $this->ana->forceFill(['monthly_salary' => 60000, 'position' => 'Developer'])->save();
        foreach ([['2026-11-13', '09:00', '09:47', 47], ['2026-11-12', '17:30', '18:00', 30], ['2026-10-30', '09:00', '09:20', 20]] as [$date, $from, $to, $min]) {
            $this->ana->lateLogs()->create(['date' => $date, 'kind' => 'late_in', 'start_time' => $from, 'end_time' => $to, 'minutes' => $min]);
        }
    }

    public function test_the_editor_prefills_tardiness_from_the_periods_lates()
    {
        $this->actingAs($this->hr)->get(route('people.payroll.edit', [$this->ana, '2026-11-01']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('payslip.tardiness_hours', 1.28)
                ->where('payslip.tardiness', 444.23)
                ->where('payslip.gross_pay', 59555.77));
    }

    public function test_saving_stores_tardiness_and_takes_it_off_gross()
    {
        $this->actingAs($this->hr)->put(route('people.payroll.update', [$this->ana, '2026-11-01']), [
            'issued_on' => '2026-11-30', 'holiday_regular_days' => 0, 'holiday_special_days' => 0, 'absences' => 0,
            'tardiness' => 400, 'overtime_allowance' => 0, 'sss' => 0, 'philhealth' => 0, 'pagibig' => 0,
            'withholding_tax' => 0, 'cash_advance' => 0,
        ])->assertSessionHasNoErrors();

        $slip = Payslip::query()->firstOrFail();
        $this->assertSame('400.00', $slip->tardiness);
        $this->assertSame('1.28', $slip->tardiness_hours);
        $this->assertSame('59600.00', $slip->gross_pay);
    }

    public function test_the_math_takes_tardiness_off_gross()
    {
        $t = PayslipMath::totals(60000, 2769.23, ['absences' => 100, 'tardiness' => 50.5], 1.0);
        $this->assertSame(59849.5, $t['gross_pay']);
        $this->assertSame(59849.5, PayslipMath::totals(60000, 2769.23, ['absences' => 150.5], 1.0)['gross_pay']);
    }

    public function test_the_migrations_roll_back()
    {
        Artisan::call('migrate:rollback', ['--path' => [
            'database/migrations/2026_11_13_000017_add_tardiness_to_payslips_table.php',
            'database/migrations/2026_11_13_000016_create_late_logs_table.php',
            'database/migrations/2026_11_13_000015_create_time_logs_table.php',
        ]]);
        $this->assertFalse(Schema::hasTable('time_logs'));
        $this->assertFalse(Schema::hasTable('late_logs'));
        $this->assertFalse(Schema::hasColumn('payslips', 'tardiness'));

        Artisan::call('migrate');
        $this->assertTrue(Schema::hasColumn('payslips', 'tardiness_hours'));
        $this->assertTrue(Schema::hasTable('late_logs'));
        $this->assertSame(0, LateLog::query()->count());
    }
}
