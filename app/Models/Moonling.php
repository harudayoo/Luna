<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One of a person's moonlings (App\Services\Moonlings). XP is per moonling (pet_events.moonling_id); one is
 * active at a time and gets the new XP. The streak, mood and pats stay per person.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind moon|star|comet|eclipse|aurora|nova
 * @property string|null $name
 * @property string $palette the wardrobe's shade (slice 7)
 * @property list<string> $wear the wardrobe's items (slice 7)
 * @property bool $active
 * @property string $source start, or the egg's achievement (its kind)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Moonling extends Model
{
    protected $fillable = ['user_id', 'kind', 'name', 'palette', 'wear', 'active', 'source'];

    protected $attributes = ['palette' => 'classic', 'wear' => '[]', 'active' => false];

    protected function casts(): array
    {
        return ['wear' => 'array', 'active' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
