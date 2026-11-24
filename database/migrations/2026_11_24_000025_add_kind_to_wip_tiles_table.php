<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pinned tiles on Home come in two rows: WIP channels (`wip`, every existing tile) and any link (`link`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wip_tiles', function (Blueprint $table) {
            $table->string('kind', 8)->default('wip')->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('wip_tiles', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
