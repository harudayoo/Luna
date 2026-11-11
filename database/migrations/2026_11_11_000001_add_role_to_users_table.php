<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Roles (employee < hr < admin) and invites: an invited person has no password until they
 * accept their invite link, so the column becomes nullable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 16)->default('employee')->index()->after('email');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Pending invites have no password; give them an unusable one so NOT NULL can return.
        DB::table('users')->whereNull('password')->update(['password' => Hash::make(Str::random(40))]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn('role');
            $table->string('password')->nullable(false)->change();
        });
    }
};
