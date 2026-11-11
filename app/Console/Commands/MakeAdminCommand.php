<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Bootstraps the first admin, and is the way back in if the admin is ever locked out:
 *   php artisan luna:make-admin you@example.com --name="Your Name"
 */
class MakeAdminCommand extends Command
{
    protected $signature = 'luna:make-admin
        {email : The admin\'s email; an existing account is promoted}
        {--name= : Name for a new account}';

    protected $description = 'Create or promote a Luna admin (and optionally set their password)';

    public function handle(): int
    {
        $email = strtolower((string) $this->argument('email'));
        $user = User::where('email', $email)->first();

        if (! $user) {
            $user = new User([
                'email' => $email,
                'name' => $this->option('name') ?: $this->ask('Name'),
            ]);
        }

        if (! $user->exists || $this->confirm('Set a new password?')) {
            $user->password = $this->askPassword();
        }

        $user->role = Role::Admin;
        $user->email_verified_at ??= now();
        $user->save();

        $this->info("{$user->email} is an admin.");

        return self::SUCCESS;
    }

    private function askPassword(): string
    {
        while (true) {
            $password = (string) $this->secret('Password');
            $validator = Validator::make(['password' => $password], ['password' => ['required', Password::default()]]);

            if ($validator->passes()) {
                return $password;
            }

            $this->error($validator->errors()->first('password'));
        }
    }
}
