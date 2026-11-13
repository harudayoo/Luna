<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A person's day at the office: Time in, Lunch start, Lunch end, Time out ("HH:MM", office time). Each person
 * stamps their own, in order; HR fixes them (People → Time). A record only: lates are charged from what
 * people declare (LateLog), never from these.
 *
 * @property int $id
 * @property int $user_id
 * @property Carbon $date
 * @property string|null $time_in
 * @property string|null $lunch_start
 * @property string|null $lunch_end
 * @property string|null $time_out
 */
class TimeLog extends Model
{
    /** The day's stamps, in the order they happen. */
    public const STEPS = ['time_in', 'lunch_start', 'lunch_end', 'time_out'];

    protected $fillable = ['date', 'time_in', 'lunch_start', 'lunch_end', 'time_out'];

    /** Now in office time (Asia/Manila; the app runs on UTC). */
    public static function officeNow(): CarbonImmutable
    {
        return CarbonImmutable::now(config('luna.office.timezone'));
    }

    /**
     * The stamps that may come next: Time in first; then Lunch start (or Time out, skipping lunch); Lunch end
     * after Lunch start; nothing after Time out.
     *
     * @return list<string>
     */
    public function allowedSteps(): array
    {
        return match (true) {
            $this->time_in === null => ['time_in'],
            $this->time_out !== null => [],
            $this->lunch_start === null => ['lunch_start', 'time_out'],
            $this->lunch_end === null => ['lunch_end'],
            default => ['time_out'],
        };
    }

    /** Stored as a plain Y-m-d (as on Leave), so lookups by date string are exact on every driver. */
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
