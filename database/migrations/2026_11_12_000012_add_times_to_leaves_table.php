<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Leave by the hour: the start and end time ("HH:MM") of a leave that isn't a full day or a half day.
 * `days` gets four decimals so hours convert exactly (2.5 h of an 8-hour day = 0.3125).
 * Rolling back rounds any hours leave to one decimal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leaves', function (Blueprint $table) {
            $table->decimal('days', 6, 4)->change();
            $table->string('start_time', 5)->nullable()->after('part');
            $table->string('end_time', 5)->nullable()->after('start_time');
        });
    }

    public function down(): void
    {
        Schema::table('leaves', function (Blueprint $table) {
            $table->dropColumn(['start_time', 'end_time']);
            $table->decimal('days', 2, 1)->change();
        });
    }
};
