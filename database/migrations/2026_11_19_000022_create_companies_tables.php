<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Client companies (tag = their short name, also a WIP tile tag) and each one's WIP item channels (boards).
 * Items may point at a channel; removing the channel leaves the item, unlinked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('tag', 4)->unique();
            $table->string('name', 80);
            $table->timestamps();
        });

        Schema::create('company_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('url', 500);
            $table->timestamps();
        });

        Schema::table('items', function (Blueprint $table) {
            $table->foreignId('channel_id')->nullable()->after('scope')->constrained('company_channels')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('channel_id');
        });
        Schema::dropIfExists('company_channels');
        Schema::dropIfExists('companies');
    }
};
