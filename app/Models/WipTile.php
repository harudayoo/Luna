<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A tile someone pinned on their own Home, under the office's tiles (config luna.wip): a WIP channel
 * (kind `wip`) or any web link (kind `link`), each its own row. Only its owner sees it. Tag is OCS, a
 * client company's or their own (1-4 letters or digits), stored uppercase.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind wip|link, fixed once pinned
 * @property string $tag
 * @property string $name
 * @property string|null $about
 * @property string $url a https://wip.quicksilversystems.com/ link for `wip`; any http(s) link for `link`
 */
class WipTile extends Model
{
    /** Tiles of each kind one person can pin. */
    public const MAX = 4;

    public const KINDS = ['wip', 'link'];

    /** Every pinned WIP channel must open WIP. */
    public const URL_PREFIX = 'https://wip.quicksilversystems.com/';

    protected $fillable = ['kind', 'tag', 'name', 'about', 'url'];

    /** @return array{id: int, kind: string, tag: string, name: string, about: string|null, url: string} */
    public function toTile(): array
    {
        return $this->only(['id', 'kind', 'tag', 'name', 'about', 'url']);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
