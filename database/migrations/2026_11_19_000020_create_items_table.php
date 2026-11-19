<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Work items people log (the item vault). Personal: the creator's alone. Company: shared with everyone.
 * Status: queue | progress | hold | done.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope', 10);
            $table->string('code', 40)->nullable();
            $table->string('title', 160);
            $table->text('notes')->nullable();
            $table->string('status', 10)->default('queue');
            $table->timestamps();

            $table->index(['scope', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
