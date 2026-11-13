<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WIP channels people pin on their own Home, under the office's tiles (up to WipTile::MAX each).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wip_tiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('tag', 4);
            $table->string('name', 40);
            $table->string('about', 80)->nullable();
            $table->string('url', 500);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wip_tiles');
    }
};
