<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
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
 * @property array<string, string> $dyes a dye per item, kept when it's taken off (spec 2026-11-26-luna-moonling-style)
 * @property bool $active
 * @property string $source start, or the egg's achievement (its kind)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Moonling extends Model
{
    protected $fillable = ['user_id', 'kind', 'name', 'palette', 'wear', 'dyes', 'active', 'source'];

    protected $attributes = ['palette' => 'classic', 'wear' => '[]', 'active' => false];

    protected function casts(): array
    {
        return ['wear' => 'array', 'active' => 'boolean'];
    }

    /** No dyes yet (null in the column) reads as none. */
    protected function dyes(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null ? [] : json_decode($value, true),
            set: fn (array $value) => json_encode((object) $value),
        );
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
