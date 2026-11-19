<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A work item in the vault. Personal items are their creator's alone; Company items are shared: everyone sees
 * them, moves their status and logs time on them. Only the creator (or HR, for a Company item) edits or deletes.
 *
 * @property int $id
 * @property int $user_id
 * @property string $scope personal | company
 * @property int|null $channel_id the client's WIP item channel, if any
 * @property string|null $code a ticket number, as people know the item
 * @property string $title
 * @property string|null $notes
 * @property string $status queue | progress | hold | done
 */
class Item extends Model
{
    public const SCOPES = ['personal' => 'Personal', 'company' => 'Company'];

    /** The legend, in the order work moves. */
    public const STATUSES = ['queue' => 'On Queue', 'progress' => 'In Progress', 'hold' => 'On Hold', 'done' => 'Done'];

    protected $fillable = ['scope', 'channel_id', 'code', 'title', 'notes', 'status'];

    /** @param Builder<Item> $query */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn ($q) => $q->where('scope', 'company')->orWhere('user_id', $user->id));
    }

    public function visibleTo(User $user): bool
    {
        return $this->scope === 'company' || $this->user_id === $user->id;
    }

    public function editableBy(User $user): bool
    {
        return $this->user_id === $user->id || ($this->scope === 'company' && $user->can('hr'));
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<CompanyChannel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(CompanyChannel::class);
    }

    /** @return HasMany<ItemTime, $this> */
    public function times(): HasMany
    {
        return $this->hasMany(ItemTime::class);
    }
}
