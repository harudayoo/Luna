<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pay is a fixed monthly salary; the daily rate (for PTO deductions) is derived from it, ÷ 22.
 * Position is printed on payslips.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('position', 80)->nullable()->after('role');
            $table->decimal('monthly_salary', 12, 2)->nullable()->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['position', 'monthly_salary']);
        });
    }
};
