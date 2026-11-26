<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Moonlings as records (spec 2026-11-25-luna-moonling-life, slice 6): each person's collection, XP per moonling.
 * Everyone gets one active `moon` moonling carrying their pet's name, and their XP history moves onto it. Down drops
 * the link and the table; the XP rows and `users.pet_name` are untouched either way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moonlings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('name', 20)->nullable();
            $table->string('palette', 10)->default('classic');
            // No column default: MySQL refuses one on JSON. The model defaults it to [] (App\Models\Moonling).
            $table->json('wear');
            $table->boolean('active')->default(false);
            // What gave it: `start` for the first, else the egg's achievement. Each once per person.
            $table->string('source', 10);
            $table->timestamps();
            $table->unique(['user_id', 'source']);
        });

        Schema::table('pet_events', function (Blueprint $table) {
            $table->foreignId('moonling_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
        });

        $now = now();
        foreach (DB::table('users')->get(['id', 'pet_name']) as $user) {
            $id = DB::table('moonlings')->insertGetId([
                'user_id' => $user->id, 'kind' => 'moon', 'name' => $user->pet_name, 'palette' => 'classic',
                'wear' => '[]', 'active' => true, 'source' => 'start', 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('pet_events')->where('user_id', $user->id)->update(['moonling_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('pet_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('moonling_id');
        });
        Schema::dropIfExists('moonlings');
    }
};
