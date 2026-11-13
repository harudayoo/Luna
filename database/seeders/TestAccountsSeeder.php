<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Two local test logins (user, 2026-11-12): an HR account and a normal employee, to try Luna from each side.
 * Safe to run again (matched by email; the password is reset). Never runs in production.
 *
 *   php artisan db:seed --class=TestAccountsSeeder
 */
class TestAccountsSeeder extends Seeder
{
    public const HR_EMAIL = 'hr@luna.test';

    public const EMPLOYEE_EMAIL = 'employee@luna.test';

    public const PASSWORD = 'luna-test-123';

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('TestAccountsSeeder makes test logins: not in production.');
        }

        $this->account(self::HR_EMAIL, 'Test HR', Role::Hr, 'HR & Office Manager', 35000);
        $this->account(self::EMPLOYEE_EMAIL, 'Test Employee', Role::Employee, 'Developer', 30000);
    }

    private function account(string $email, string $name, Role $role, string $position, int $monthly): void
    {
        $user = User::query()->firstOrNew(['email' => $email]);
        $user->forceFill([
            'name' => $name,
            'password' => self::PASSWORD,
            'role' => $role,
            'position' => $position,
            'monthly_salary' => $monthly,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();
    }
}
