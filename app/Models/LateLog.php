<?php

namespace App\Models;

use App\Services\Payroll\PayRate;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A late someone declares (honour system, as they post it in WIP's OCS Attendance channel): late in, a long
 * lunch, early out or an errand, from start_time to end_time. Only the part inside office hours is charged
 * (`minutes`), at the accountant's hourly rate on the payslip's Tardiness line. Never touches PTO.
 *
 * @property int $id
 * @property int $user_id
 * @property Carbon $date
 * @property string $kind late_in | lunch | early_out | errand
 * @property string $start_time "HH:MM"
 * @property string $end_time "HH:MM"
 * @property int $minutes charged minutes (office hours only)
 * @property string|null $note
 */
class LateLog extends Model
{
    public const KINDS = [
        'late_in' => 'Late in',
        'lunch' => 'Long lunch',
        'early_out' => 'Early out',
        'errand' => 'Errand',
    ];

    protected $fillable = ['date', 'kind', 'start_time', 'end_time', 'minutes', 'note'];

    protected function casts(): array
    {
        return ['minutes' => 'integer'];
    }

    /** Minutes of a span inside office hours (Leave::OFFICE_HOURS), lunch left out. */
    public static function chargedMinutes(string $start, string $end): int
    {
        return (int) round(Leave::workingHours($start, $end) * 60);
    }

    /**
     * Someone's declared lates in a period: [hours rounded to 2 decimals, pesos]. Pesos come from the exact
     * hours at the accountant's rate (PayRate), rounded once; null without a salary.
     *
     * @return array{0: float, 1: float|null, 2: int}
     */
    public static function tardiness(User $user, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $minutes = (int) $user->lateLogs()->whereBetween('date', [$start->toDateString(), $end->toDateString()])->sum('minutes');
        $exact = $minutes / 60;

        return [round($exact, 2), $minutes === 0 ? 0.0 : PayRate::forHours($user, $exact, Policy::current(), $start), $minutes];
    }

    /** Stored as a plain Y-m-d (as on Leave), so range queries with date strings are exact. */
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
