<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A WIP channel someone pinned on their own Home, under the office's tiles (config luna.wip). Only its owner
 * sees it. Tag is OCS, QSS or their own (1-4 letters or digits), stored uppercase.
 *
 * @property int $id
 * @property int $user_id
 * @property string $tag
 * @property string $name
 * @property string|null $about
 * @property string $url a https://wip.quicksilversystems.com/ link
 */
class WipTile extends Model
{
    /** Tiles one person can pin. */
    public const MAX = 4;

    /** Every pinned link must open WIP. */
    public const URL_PREFIX = 'https://wip.quicksilversystems.com/';

    protected $fillable = ['tag', 'name', 'about', 'url'];

    /** @return array{id: int, tag: string, name: string, about: string|null, url: string} */
    public function toTile(): array
    {
        return $this->only(['id', 'tag', 'name', 'about', 'url']);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
