<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-person PTO values HR sets: daily rate (pesos, for deductions), the date PTO tracking
 * starts (null = the day the account was created) and the opening balance in hours.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('daily_rate', 10, 2)->nullable()->after('role');
            $table->date('pto_start')->nullable()->after('daily_rate');
            $table->decimal('pto_opening_hours', 7, 2)->default(0)->after('pto_start');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['daily_rate', 'pto_start', 'pto_opening_hours']);
        });
    }
};
