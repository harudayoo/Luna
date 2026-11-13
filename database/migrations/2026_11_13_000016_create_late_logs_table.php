<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lates people declare (as they post them in WIP's Attendance channel): a time span on a date. `minutes` is
 * what's charged, the part inside office hours.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('late_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('kind', 12);
            $table->string('start_time', 5);
            $table->string('end_time', 5);
            $table->unsignedSmallInteger('minutes');
            $table->string('note', 120)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('late_logs');
    }
};
