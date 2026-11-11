<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A public holiday: an office-wide non-working day. It isn't counted as work hours, can't be
 * logged as leave, and leave already on it isn't charged. HR keeps the list (2026 is seeded).
 *
 * @property int $id
 * @property Carbon $date
 * @property string $name
 * @property string $kind regular | special (special non-working day)
 */
class Holiday extends Model
{
    public const KINDS = ['regular', 'special'];

    protected $fillable = ['date', 'name', 'kind'];

    /** Plain Y-m-d on every driver, as on Leave. */
    protected function date(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value === null ? null : Carbon::parse($value)->startOfDay(),
            set: fn (mixed $value) => Carbon::parse($value)->toDateString(),
        );
    }

    /**
     * Holiday names keyed by Y-m-d, optionally limited to [from, to].
     *
     * @return array<string, string>
     */
    public static function names(?string $from = null, ?string $to = null): array
    {
        return static::query()
            ->when($from, fn ($q) => $q->where('date', '>=', $from))
            ->when($to, fn ($q) => $q->where('date', '<=', $to))
            ->pluck('name', 'date')
            ->mapWithKeys(fn ($name, $date) => [substr((string) $date, 0, 10) => $name])
            ->all();
    }
}
