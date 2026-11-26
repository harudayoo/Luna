<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `users.pet_name` is no longer read or written: names live on moonlings since migration 000029, which copied each
 * person's pet name onto their first moonling (source `start`). Down brings the column back and refills it from
 * that moonling, so going down and up loses nothing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('pet_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pet_name', 20)->nullable();
        });

        foreach (DB::table('moonlings')->where('source', 'start')->whereNotNull('name')->get(['user_id', 'name']) as $m) {
            DB::table('users')->where('id', $m->user_id)->update(['pet_name' => $m->name]);
        }
    }
};
