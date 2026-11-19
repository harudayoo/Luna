<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Time on an item (UTC). Running while ended_at is null: a stopwatch, or a countdown that ends itself at
 * started_at + target_minutes. One running per person. A record only.
 *
 * @property int $id
 * @property int $item_id
 * @property int $user_id
 * @property CarbonImmutable $started_at
 * @property CarbonImmutable|null $ended_at
 * @property int|null $target_minutes
 */
class ItemTime extends Model
{
    protected $fillable = ['item_id', 'started_at', 'ended_at', 'target_minutes'];

    protected function casts(): array
    {
        return ['started_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime', 'target_minutes' => 'integer'];
    }

    /** Whole minutes, up to now while running. */
    public function minutes(): int
    {
        return intdiv((int) $this->started_at->diffInSeconds($this->ended_at ?? CarbonImmutable::now(), true), 60);
    }

    /** Minutes as WIP takes them: 2h 35m, 45m, 2h. */
    public static function wip(int $minutes): string
    {
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return $h === 0 ? "{$m}m" : ($m === 0 ? "{$h}h" : "{$h}h {$m}m");
    }

    /** When a countdown runs out; null for a stopwatch. */
    public function due(): ?CarbonImmutable
    {
        return $this->target_minutes ? $this->started_at->addMinutes($this->target_minutes) : null;
    }

    /** Stops this person's running time now (a countdown never past its target). */
    public static function stopRunning(User $user): void
    {
        $user->itemTimes()->whereNull('ended_at')->get()->each(function (ItemTime $t) {
            $now = CarbonImmutable::now();
            $t->ended_at = $t->due() !== null && $t->due()->lt($now) ? $t->due() : $now;
            $t->save();
        });
    }

    /** Closes this person's countdowns that ran out while nobody was looking (the tab was closed). */
    public static function closeOverdue(User $user): void
    {
        $user->itemTimes()->whereNull('ended_at')->whereNotNull('target_minutes')->get()
            ->filter(fn (ItemTime $t) => $t->due()->lte(CarbonImmutable::now()))
            ->each(fn (ItemTime $t) => $t->forceFill(['ended_at' => $t->due()])->save());
    }

    /** @return BelongsTo<Item, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
