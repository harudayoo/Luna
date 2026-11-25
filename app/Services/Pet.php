<?php

namespace App\Services;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\PetEvent;
use App\Models\TimeLog;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Each person's pet on Home (spec 2026-11-24-luna-pet): it grows from XP for a daily visit (with a streak bonus),
 * item time, leave and opening one's own released payslip. Every award is once-only through its (kind, ref), and
 * all dates are office dates (Manila), not the app's UTC date.
 */
final class Pet
{
    public const XP = ['visit' => 5, 'item_time' => 10, 'leave' => 5, 'payslip' => 5];

    public const STREAK_BONUS_MAX = 5;

    /** Total XP at which each stage starts. */
    public const STAGES = [0, 40, 150, 400, 900];

    public const STAGE_NAMES = ['Egg', 'Hatchling', 'Moonling', 'Bright', 'Full Moon'];

    /** How far back a streak is counted. */
    private const STREAK_WINDOW_DAYS = 60;

    /** Session flag: an award crossed a stage, shown once on the next Home load. */
    public const GREW = 'pet_grew';

    public static function today(): string
    {
        return TimeLog::officeNow()->toDateString();
    }

    /** Gives the award once; true when it is new. */
    public static function award(User $user, string $kind, string $ref, ?int $xp = null): bool
    {
        $before = self::xp($user);
        $new = PetEvent::query()->insertOrIgnore([
            'user_id' => $user->id, 'kind' => $kind, 'ref' => $ref,
            'xp' => $xp ?? self::XP[$kind], 'created_at' => now(),
        ]) > 0;

        if ($new && self::stageFor(self::xp($user)) > self::stageFor($before)) {
            session()->put(self::GREW, true);
        }

        return $new;
    }

    /** Today's visit: 5 XP plus 1 per streak day before today, up to +5. True when it is new. */
    public static function visit(User $user): bool
    {
        $bonus = min(self::STREAK_BONUS_MAX, self::streak($user));

        return self::award($user, 'visit', self::today(), self::XP['visit'] + $bonus);
    }

    /**
     * Office days in a row with a visit, counting back from today. Weekends, holidays and the person's own leave
     * days without a visit are skipped, and so is today until it is visited; any other day without one ends it.
     */
    public static function streak(User $user): int
    {
        $today = CarbonImmutable::parse(self::today());
        $from = $today->subDays(self::STREAK_WINDOW_DAYS)->toDateString();
        $to = $today->toDateString();

        $visits = PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')
            ->whereBetween('ref', [$from, $to])->pluck('ref')->flip();
        $closed = Holiday::query()->whereBetween('date', [$from, $to])->toBase()->pluck('date')
            ->merge(Leave::query()->where('user_id', $user->id)->whereBetween('date', [$from, $to])->toBase()->pluck('date'))
            ->flip();

        $streak = 0;
        for ($day = $today; $day->toDateString() >= $from; $day = $day->subDay()) {
            $date = $day->toDateString();
            if ($visits->has($date)) {
                $streak++;
            } elseif (! ($date === $to || $day->isWeekend() || $closed->has($date))) {
                break;
            }
        }

        return $streak;
    }

    /** @return array{xp: int, stage: int, stage_name: string, next_at: int|null, streak: int, fed_today: bool} */
    public static function state(User $user): array
    {
        $xp = self::xp($user);
        $stage = self::stageFor($xp);

        return [
            'xp' => $xp,
            'stage' => $stage,
            'stage_name' => self::STAGE_NAMES[$stage],
            'next_at' => self::STAGES[$stage + 1] ?? null,
            'streak' => self::streak($user),
            'fed_today' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->where('ref', self::today())->exists(),
        ];
    }

    private static function xp(User $user): int
    {
        return (int) PetEvent::query()->where('user_id', $user->id)->sum('xp');
    }

    private static function stageFor(int $xp): int
    {
        return count(array_filter(self::STAGES, fn (int $at) => $xp >= $at)) - 1;
    }
}
