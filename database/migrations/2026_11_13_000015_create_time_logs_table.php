<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per person per day: the four stamps ("HH:MM", office time). A record only; nothing is charged from it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('time_in', 5)->nullable();
            $table->string('lunch_start', 5)->nullable();
            $table->string('lunch_end', 5)->nullable();
            $table->string('time_out', 5)->nullable();
            $table->foreignId('edited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_logs');
    }
};
