<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tardiness gets its own payslip line: the declared lates' hours and their pesos. Existing payslips get 0,
 * so their totals don't change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->decimal('tardiness_hours', 6, 2)->default(0)->after('absences');
            $table->decimal('tardiness', 12, 2)->default(0)->after('tardiness_hours');
        });
    }

    public function down(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->dropColumn(['tardiness_hours', 'tardiness']);
        });
    }
};
