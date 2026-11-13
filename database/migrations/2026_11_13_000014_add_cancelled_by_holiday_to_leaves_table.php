<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Leave HR cancels for a new holiday is set aside (cancelled_by_holiday_id) instead of deleted, so it comes
 * back if the holiday is removed or moved. No foreign key: the holiday controller restores the leave itself.
 * Rolling back deletes leave still set aside, as cancelling did before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leaves', function (Blueprint $table) {
            $table->unsignedBigInteger('cancelled_by_holiday_id')->nullable()->after('note')->index();
        });
    }

    public function down(): void
    {
        DB::table('leaves')->whereNotNull('cancelled_by_holiday_id')->delete();
        Schema::table('leaves', function (Blueprint $table) {
            $table->dropIndex(['cancelled_by_holiday_id']);
            $table->dropColumn('cancelled_by_holiday_id');
        });
    }
};
