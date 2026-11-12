<?php

namespace Tests\Feature\People;

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\TestAccountsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Local test logins: one HR account and one employee, safe to seed again. */
class TestAccountsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_an_hr_and_an_employee_account_once()
    {
        $this->seed(TestAccountsSeeder::class);
        $this->seed(TestAccountsSeeder::class);

        $hr = User::where('email', TestAccountsSeeder::HR_EMAIL)->sole();
        $employee = User::where('email', TestAccountsSeeder::EMPLOYEE_EMAIL)->sole();

        $this->assertSame(Role::Hr, $hr->role);
        $this->assertSame(Role::Employee, $employee->role);
        $this->assertTrue(Hash::check(TestAccountsSeeder::PASSWORD, $employee->password));
        $this->assertNotNull($employee->email_verified_at);
        $this->assertNotNull($employee->monthly_salary);

        $this->post(route('login.store'), ['email' => $hr->email, 'password' => TestAccountsSeeder::PASSWORD])
            ->assertRedirect(route('dashboard', absolute: false));
    }
}
