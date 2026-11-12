<?php

namespace App\Models;

use Database\Factories\LeaveFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A day off: full (1), half (0.5), or some hours of it (start_time-end_time; days = working hours ÷ the
 * policy's hours per day). No approval step: people log their own.
 *
 * @property int $id
 * @property int $user_id
 * @property Carbon $date
 * @property string $days decimal, e.g. "1.0000", "0.5000", or "0.3125" for 2.5 h
 * @property string|null $part "am" or "pm" for a half day; null for a full day (or an older half day)
 * @property string|null $start_time "HH:MM" for leave by the hour, else null
 * @property string|null $end_time "HH:MM" for leave by the hour, else null
 * @property string|null $note
 */
class Leave extends Model
{
    /** @use HasFactory<LeaveFactory> */
    use HasFactory;

    /** Office hours (user, 2026-11-12): 9:00-18:00 with lunch 12-1, so 8 working hours. Leave by the hour fits in these. */
    public const OFFICE_HOURS = [['09:00', '12:00'], ['13:00', '18:00']];

    /** A morning or an afternoon off: the first or second block of office hours (3 h and 5 h; user, 2026-11-12). */
    public const HALVES = ['am' => self::OFFICE_HOURS[0], 'pm' => self::OFFICE_HOURS[1]];

    /** Leave by the hour starts and ends on these steps (minutes). */
    public const TIME_STEP = 30;

    protected $fillable = ['date', 'days', 'part', 'start_time', 'end_time', 'note'];

    protected function casts(): array
    {
        return [
            'days' => 'decimal:4',
        ];
    }

    /** Working hours between two "HH:MM" times: office hours only, lunch left out. */
    public static function workingHours(string $start, string $end): float
    {
        $minutes = fn (string $t) => (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2);
        $total = 0;
        foreach (self::OFFICE_HOURS as [$open, $close]) {
            $total += max(0, min($minutes($end), $minutes($close)) - max($minutes($start), $minutes($open)));
        }

        return $total / 60;
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
