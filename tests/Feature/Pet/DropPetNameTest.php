<?php

namespace Tests\Feature\Pet;

use App\Models\Moonling;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * `users.pet_name` is dropped (names live on moonlings since slice 6). Down brings the column back and refills it
 * from each person's first moonling, where migration 000029 had moved the names.
 */
class DropPetNameTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_column_is_gone_and_comes_back_with_the_names_on_the_way_down()
    {
        $this->assertFalse(Schema::hasColumn('users', 'pet_name'));
        $this->assertTrue(Schema::hasColumn('users', 'pet_public'));

        $ana = User::factory()->create(['name' => 'Ana Cruz']);
        $ben = User::factory()->create(['name' => 'Ben Reyes']);
        Moonling::query()->create(['user_id' => $ana->id, 'kind' => 'moon', 'source' => 'start', 'name' => 'Mochi', 'active' => false]);
        Moonling::query()->create(['user_id' => $ana->id, 'kind' => 'star', 'source' => 'star', 'name' => 'Tala', 'active' => true]);
        Moonling::query()->create(['user_id' => $ben->id, 'kind' => 'moon', 'source' => 'start', 'active' => true]);

        $migration = require database_path('migrations/2026_11_26_000031_drop_pet_name_from_users_table.php');
        $migration->down();
        $this->assertTrue(Schema::hasColumn('users', 'pet_name'));
        $this->assertSame(
            [$ana->id => 'Mochi', $ben->id => null],
            DB::table('users')->orderBy('id')->pluck('pet_name', 'id')->all(),
        );

        $migration->up();
        $this->assertFalse(Schema::hasColumn('users', 'pet_name'));
    }
}
