<?php

namespace App\Services;

use App\Models\Holiday;
use App\Models\Item;
use App\Models\Leave;
use App\Models\Payslip;
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

        // Only for the person on this request: a duel also pays the challenger, who isn't here to see it.
        if ($new && $user->is(auth()->user()) && self::stageFor(self::xp($user)) > self::stageFor($before)) {
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
        return self::streaks([$user->id])[$user->id];
    }

    /**
     * `streak` for many people at once (the office board): three queries however many there are.
     *
     * @param  list<int>  $userIds
     * @return array<int, int> streak by user id
     */
    public static function streaks(array $userIds): array
    {
        $today = CarbonImmutable::parse(self::today());
        $from = $today->subDays(self::STREAK_WINDOW_DAYS)->toDateString();
        $to = $today->toDateString();

        $visits = PetEvent::query()->whereIn('user_id', $userIds)->where('kind', 'visit')
            ->whereBetween('ref', [$from, $to])->toBase()->get(['user_id', 'ref'])
            ->groupBy('user_id')->map(fn ($rows) => $rows->pluck('ref')->flip());
        $holidays = Holiday::query()->whereBetween('date', [$from, $to])->toBase()->pluck('date')->flip();
        $leaves = Leave::query()->whereIn('user_id', $userIds)->whereBetween('date', [$from, $to])
            ->toBase()->get(['user_id', 'date'])
            ->groupBy('user_id')->map(fn ($rows) => $rows->pluck('date')->flip());

        $streaks = [];
        foreach ($userIds as $id) {
            $mine = $visits[$id] ?? collect();
            $off = $leaves[$id] ?? collect();
            $streak = 0;
            for ($day = $today; $day->toDateString() >= $from; $day = $day->subDay()) {
                $date = $day->toDateString();
                if ($mine->has($date)) {
                    $streak++;
                } elseif (! ($date === $to || $day->isWeekend() || $holidays->has($date) || $off->has($date))) {
                    break;
                }
            }
            $streaks[$id] = $streak;
        }

        return $streaks;
    }

    /**
     * The office board (spec 2026-11-25-luna-pet-social, slice 2): active people who joined, ranked by stage, then
     * streak, then name. The top 10, plus your own row under them when you're on it but lower. No XP for anyone.
     *
     * @return array{joined: bool, rows: list<array{rank: int, user_id: int, first_name: string, pet_name: string|null, stage: int, stage_name: string, streak: int, me: bool}>}
     */
    public static function board(User $me): array
    {
        $people = User::query()->where('pet_public', true)
            ->whereNull('deactivated_at')->whereNotNull('password')
            ->get(['id', 'name', 'pet_name']);
        $ids = $people->pluck('id')->all();
        $stages = self::stages($ids);
        $streaks = self::streaks($ids);
        $champions = PetDuels::champions();

        $ranked = $people->map(function (User $u) use ($stages, $streaks, $champions, $me) {
            $stage = $stages[$u->id];

            return [
                // The person, so a duel can be sent from their row (slice 3).
                'user_id' => $u->id,
                'first_name' => strtok($u->name, ' ') ?: $u->name,
                'pet_name' => $u->pet_name,
                'stage' => $stage,
                'stage_name' => self::STAGE_NAMES[$stage],
                'streak' => $streaks[$u->id],
                'me' => $u->is($me),
                // Last week's Moon Cup champion (slice 4).
                'crown' => in_array($u->id, $champions, true),
                'sort_name' => $u->name,
            ];
        })->sort(fn ($a, $b) => [$b['stage'], $b['streak'], $a['sort_name']] <=> [$a['stage'], $a['streak'], $b['sort_name']])
            ->values()
            ->map(fn ($row, $i) => ['rank' => $i + 1] + collect($row)->except('sort_name')->all());

        $rows = $ranked->take(10);
        $mine = $ranked->firstWhere('me', true);
        if ($mine && $mine['rank'] > 10) {
            $rows->push($mine);
        }

        return ['joined' => (bool) $me->pet_public, 'rows' => $rows->values()->all(), 'cup' => PetDuels::cup($me)];
    }

    /** @return array{name: string|null, public: bool, xp: int, stage: int, stage_name: string, next_at: int|null, streak: int, fed_today: bool, crown: bool} */
    public static function state(User $user): array
    {
        $xp = self::xp($user);
        $stage = self::stageFor($xp);

        return [
            'name' => $user->pet_name,
            'public' => (bool) $user->pet_public,
            'xp' => $xp,
            'stage' => $stage,
            'stage_name' => self::STAGE_NAMES[$stage],
            'next_at' => self::STAGES[$stage + 1] ?? null,
            'streak' => self::streak($user),
            'fed_today' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->where('ref', self::today())->exists(),
            'crown' => in_array($user->id, PetDuels::champions(), true),
        ];
    }

    /**
     * What the pet panel shows besides `state` (spec 2026-11-25-luna-pet-social): what gives XP, this office week,
     * and the last 10 awards. Loaded only when the panel opens.
     *
     * @return array{xp: array<string, int>, streak_bonus_max: int, week: list<array{date: string, day: string, status: string}>, recent: list<array{xp: int, label: string, at: string}>}
     */
    public static function detail(User $user): array
    {
        return [
            'xp' => self::XP,
            'streak_bonus_max' => self::STREAK_BONUS_MAX,
            'duel_xp' => PetDuels::XP,
            'week' => self::week($user),
            'recent' => self::recent($user),
        ];
    }

    /** Mon–Fri of this office week: visited, missed, skipped (holiday or own leave) or upcoming (today included until visited). */
    private static function week(User $user): array
    {
        $today = self::today();
        $monday = CarbonImmutable::parse($today)->startOfWeek(CarbonImmutable::MONDAY);
        $from = $monday->toDateString();
        $to = $monday->addDays(4)->toDateString();

        $visits = PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')
            ->whereBetween('ref', [$from, $to])->pluck('ref')->flip();
        $closed = Holiday::query()->whereBetween('date', [$from, $to])->toBase()->pluck('date')
            ->merge(Leave::query()->where('user_id', $user->id)->whereBetween('date', [$from, $to])->toBase()->pluck('date'))
            ->flip();

        return collect(range(0, 4))->map(function (int $i) use ($monday, $today, $visits, $closed) {
            $day = $monday->addDays($i);
            $date = $day->toDateString();

            return ['date' => $date, 'day' => $day->format('D'), 'status' => match (true) {
                $visits->has($date) => 'visited',
                $date >= $today => 'upcoming',
                $closed->has($date) => 'skipped',
                default => 'missed',
            }];
        })->all();
    }

    /** The last 10 awards, newest first, each with a line a person can read. */
    private static function recent(User $user): array
    {
        $events = PetEvent::query()->where('user_id', $user->id)
            ->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get();

        $itemIds = $events->where('kind', 'item_time')->map(fn (PetEvent $e) => (int) strtok($e->ref, ':'));
        $items = Item::query()->whereIn('id', $itemIds)->pluck('title', 'id');
        $slips = Payslip::query()->whereIn('id', $events->where('kind', 'payslip')->pluck('ref'))->get()->keyBy('id');
        $tz = config('luna.office.timezone');

        return $events->map(fn (PetEvent $e) => [
            'xp' => $e->xp,
            'label' => match ($e->kind) {
                'visit' => 'Daily visit',
                'item_time' => ($title = $items[(int) strtok($e->ref, ':')] ?? null) ? "Logged time on {$title}" : 'Logged time',
                'leave' => 'Filed leave for '.CarbonImmutable::parse($e->ref)->format('M j'),
                'payslip' => ($slip = $slips[(int) $e->ref] ?? null)
                    ? 'Opened your payslip for '.self::period($slip->period_start, $slip->period_end)
                    : 'Opened your payslip',
                'duel' => $e->xp >= PetDuels::XP['win'] ? 'Won a moon duel' : 'Played a moon duel',
                default => ucfirst(str_replace('_', ' ', $e->kind)),
            },
            'at' => $e->created_at?->timezone($tz)->toDateString() ?? $e->ref,
        ])->values()->all();
    }

    /** "Nov 1–15", or "Oct 26–Nov 10" across months. */
    private static function period(\DateTimeInterface $start, \DateTimeInterface $end): string
    {
        $s = CarbonImmutable::instance($start);
        $e = CarbonImmutable::instance($end);

        return $s->format('M j').'–'.($s->isSameMonth($e) ? $e->format('j') : $e->format('M j'));
    }

    /**
     * The stage of many people's pets in one query (the board, duel challengers).
     *
     * @param  list<int>  $userIds
     * @return array<int, int> stage by user id
     */
    public static function stages(array $userIds): array
    {
        $xp = PetEvent::query()->whereIn('user_id', $userIds)->groupBy('user_id')
            ->selectRaw('user_id, sum(xp) as total')->toBase()->pluck('total', 'user_id');

        return collect($userIds)->mapWithKeys(fn (int $id) => [$id => self::stageFor((int) ($xp[$id] ?? 0))])->all();
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
