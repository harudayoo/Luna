<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** XP awards for each person's pet (App\Services\Pet). One row per award; the unique key stops double awards. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pet_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('ref', 40);
            $table->unsignedSmallInteger('xp');
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'kind', 'ref']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pet_events');
    }
};
