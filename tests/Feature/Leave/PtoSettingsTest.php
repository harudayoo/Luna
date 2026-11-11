<?php

namespace Tests\Feature\Leave;

use App\Models\Setting;
use App\Models\User;
use App\Services\Pto\AccrualMode;
use App\Services\Pto\Policy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PtoSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_office_policy_defaults_to_full_accrual_of_3_33_hours()
    {
        $policy = Policy::current();

        $this->assertSame(AccrualMode::Full, $policy->mode);
        $this->assertSame(3.33, $policy->accrualHours);
        $this->assertSame(8.0, $policy->hoursPerDay);
        $this->assertSame(10.0, $policy->monthlyCapDays);
    }

    public function test_one_stored_accrual_mode_applies_to_everyone()
    {
        Setting::put('pto.accrual_mode', 'all');
        $this->assertSame(AccrualMode::All, Policy::current()->mode);

        Setting::put('pto.accrual_mode', 'nonsense');
        $this->assertSame(AccrualMode::Full, Policy::current()->mode);
    }

    public function test_pto_start_defaults_to_the_day_the_account_was_created()
    {
        $this->travelTo('2026-11-11');
        $user = User::factory()->create();

        $this->assertSame('2026-11-11', $user->ptoStart()->toDateString());
        $this->assertSame(0.0, (float) $user->fresh()->pto_opening_hours);
    }

    public function test_the_migrations_reverse_cleanly()
    {
        $migrations = array_map(
            fn (string $name) => require database_path("migrations/$name.php"),
            ['2026_11_11_000004_create_leaves_table', '2026_11_11_000003_add_pto_fields_to_users_table', '2026_11_11_000002_create_settings_table'],
        );

        foreach ($migrations as $migration) {
            $migration->down();
        }
        $this->assertFalse(Schema::hasTable('leaves'));
        $this->assertFalse(Schema::hasColumn('users', 'daily_rate'));
        $this->assertFalse(Schema::hasTable('settings'));

        foreach (array_reverse($migrations) as $migration) {
            $migration->up();
        }
        $this->assertTrue(Schema::hasTable('leaves'));
        $this->assertTrue(Schema::hasColumn('users', 'pto_start'));
        $this->assertTrue(Schema::hasTable('settings'));
    }
}
