<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A daily rate HR can pin for one person (pesos). Empty means the rate follows the month:
 * monthly salary ÷ that month's working days (App\Services\Payroll\WorkDays).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('fixed_daily_rate', 10, 2)->nullable()->after('daily_rate');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('fixed_daily_rate');
        });
    }
};
