<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The pet's name, and whether it shows on the office board (spec 2026-11-25-luna-pet-social). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pet_name', 20)->nullable();
            $table->boolean('pet_public')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['pet_name', 'pet_public']);
        });
    }
};
