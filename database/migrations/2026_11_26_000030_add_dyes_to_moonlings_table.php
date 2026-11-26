<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dyes (spec 2026-11-26-luna-moonling-style, slice 10): each moonling remembers a dye per item (item key → dye key),
 * kept when the item is taken off. Nullable with no default, as MySQL refuses one on JSON; null reads as none.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('moonlings', function (Blueprint $table) {
            $table->json('dyes')->nullable()->after('wear');
        });
    }

    public function down(): void
    {
        Schema::table('moonlings', function (Blueprint $table) {
            $table->dropColumn('dyes');
        });
    }
};
