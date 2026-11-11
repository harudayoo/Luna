<?php

namespace App\Models;

use Database\Factories\LeaveFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A day off: full (1) or half (0.5). No approval step: people log their own.
 *
 * @property int $id
 * @property int $user_id
 * @property Carbon $date
 * @property string $days decimal, "1.0" or "0.5"
 * @property string|null $note
 */
class Leave extends Model
{
    /** @use HasFactory<LeaveFactory> */
    use HasFactory;

    protected $fillable = ['date', 'days', 'note'];

    protected function casts(): array
    {
        return [
            'days' => 'decimal:1',
        ];
    }

    /**
     * Stored as a plain Y-m-d on every driver, so range queries with date strings are exact
     * (a "date" cast writes "Y-m-d 00:00:00" on SQLite, which sorts after "Y-m-d").
     */
    protected function date(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null ? null : Carbon::parse($value)->startOfDay(),
            set: fn (mixed $value) => Carbon::parse($value)->toDateString(),
        );
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
