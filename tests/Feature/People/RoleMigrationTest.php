<?php

namespace Tests\Feature\People;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RoleMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_accounts_are_employees_by_default()
    {
        $user = User::factory()->create();

        $this->assertSame(Role::Employee, $user->fresh()->role);
    }

    public function test_the_migration_reverses_cleanly()
    {
        User::factory()->invited()->create();
        $migration = require database_path('migrations/2026_11_11_000001_add_role_to_users_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'role'));

        $migration->up();
        $this->assertTrue(Schema::hasColumn('users', 'role'));
    }
}
