<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Holiday;
use App\Models\Item;
use App\Models\Leave;
use App\Models\Payslip;
use App\Models\PetDuel;
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
    public const XP = ['visit' => 5, 'item_time' => 10, 'leave' => 5, 'payslip' => 5, 'duty' => 10];

    /** HR and admin work that pays duty XP (spec 2026-11-26-luna-moonling-style, slice 11), with its recent-list label. */
    public const DUTIES = ['payroll' => 'Payroll work', 'people' => 'People work', 'calendar' => 'Calendar work'];

    public const STREAK_BONUS_MAX = 5;

    /** Total XP at which each stage starts. */
    public const STAGES = [0, 40, 150, 400, 900];

    public const STAGE_NAMES = ['Egg', 'Hatchling', 'Moonling', 'Bright', 'Full Moon'];

    /** How far back a streak is counted. */
    private const STREAK_WINDOW_DAYS = 60;

    /** Mood (spec 2026-11-25-luna-moonling-life, slice 5): office days looked back on, and each level's floor. */
    public const MOOD_DAYS = 5;

    public const MOOD_LEVELS = ['glowing' => 90, 'happy' => 70, 'okay' => 45, 'droopy' => 20, 'gloomy' => 0];

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
        // To the active moonling (slice 6); the streak, mood and pats stay per person through user_id.
        $new = PetEvent::query()->insertOrIgnore([
            'user_id' => $user->id, 'moonling_id' => Moonlings::active($user)->id, 'kind' => $kind, 'ref' => $ref,
            'xp' => $xp ?? self::XP[$kind], 'created_at' => now(),
        ]) > 0;

        // Only for the person on this request: a duel also pays the challenger, who isn't here to see it.
        if ($new && $user->is(auth()->user()) && self::stageFor(self::xp($user)) > self::stageFor($before)) {
            session()->put(self::GREW, true);
        }
        if ($new) {
            Moonlings::checkEggs($user);
            Moonlings::checkUnlocks($user);
        }

        return $new;
    }

    /**
     * HR or admin work in one area (payroll, people, calendar): 10 XP once per area per office day, so 30 at most.
     * Called by the HR controllers after a successful save only; deletes and undos never call it.
     */
    public static function duty(User $user, string $area): void
    {
        self::award($user, 'duty', $area.':'.self::today());
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
     * @return array{joined: bool, rows: list<array{rank: int, user_id: int, first_name: string, pet_name: string|null, kind: string, stage: int, stage_name: string, streak: int, me: bool}>}
     */
    public static function board(User $me): array
    {
        $people = User::query()->where('pet_public', true)
            ->whereNull('deactivated_at')->whereNotNull('password')
            ->get(['id', 'name']);
        $ids = $people->pluck('id')->all();
        $stages = self::stages($ids);
        $streaks = self::streaks($ids);
        $champions = PetDuels::champions();
        // Each person's active moonling (slice 6): its name and kind.
        $pets = Moonlings::activeOf($ids);

        $ranked = $people->map(function (User $u) use ($stages, $streaks, $champions, $pets, $me) {
            $stage = $stages[$u->id];

            return [
                // The person, so a duel can be sent from their row (slice 3).
                'user_id' => $u->id,
                'first_name' => strtok($u->name, ' ') ?: $u->name,
                'pet_name' => $pets[$u->id]->name ?? null,
                'kind' => $pets[$u->id]->kind ?? 'moon',
                'palette' => $pets[$u->id]->palette ?? 'classic',
                'wear' => $pets[$u->id]->wear ?? [],
                'dyes' => $pets[$u->id]->dyes ?? [],
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

    /** @return array{name: string|null, kind: string, public: bool, xp: int, stage: int, stage_name: string, next_at: int|null, streak: int, fed_today: bool, crown: bool} */
    public static function state(User $user): array
    {
        $pet = Moonlings::active($user);
        $xp = Moonlings::xp($pet);
        $stage = self::stageFor($xp);

        return [
            // The active moonling (slice 6); its id is what the wardrobe saves to (slice 7).
            'moonling_id' => $pet->id,
            'name' => $pet->name,
            'kind' => $pet->kind,
            // The wardrobe (slice 7).
            'palette' => $pet->palette,
            'wear' => $pet->wear,
            'dyes' => $pet->dyes,
            'public' => (bool) $user->pet_public,
            'xp' => $xp,
            'stage' => $stage,
            'stage_name' => self::STAGE_NAMES[$stage],
            'next_at' => self::STAGES[$stage + 1] ?? null,
            'streak' => self::streak($user),
            'fed_today' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->where('ref', self::today())->exists(),
            'crown' => in_array($user->id, PetDuels::champions(), true),
            // Private: only ever in the owner's own `pet` prop (slice 5).
            ...self::feelings($user),
            'today' => self::news($user),
        ];
    }

    /** Today's first pat: no XP, once an office day. */
    public static function pat(User $user): void
    {
        self::award($user, 'pat', self::today(), 0);
    }

    /**
     * Mood over the MOOD_DAYS office days before today (weekends, holidays, own leave and days before the first
     * visit skipped): 100, −20 for each without a visit, +10 for today's pat, within 0–100. Lates are never read.
     * `days_away`: office days missed in a row right before today.
     *
     * @return array{mood: array{score: int, level: string, patted: bool}, days_away: int}
     */
    private static function feelings(User $user): array
    {
        $today = CarbonImmutable::parse(self::today());
        $from = $today->subDays(self::STREAK_WINDOW_DAYS)->toDateString();
        $yesterday = $today->subDay()->toDateString();

        $events = PetEvent::query()->where('user_id', $user->id)->whereIn('kind', ['visit', 'pat'])
            ->whereBetween('ref', [$from, $today->toDateString()])->toBase()->get(['kind', 'ref']);
        $visits = $events->where('kind', 'visit')->pluck('ref')->flip();
        $patted = $events->where('kind', 'pat')->contains('ref', $today->toDateString());
        $first = PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->min('ref');
        $closed = Holiday::query()->whereBetween('date', [$from, $yesterday])->toBase()->pluck('date')
            ->merge(Leave::query()->where('user_id', $user->id)->whereBetween('date', [$from, $yesterday])->toBase()->pluck('date'))
            ->flip();

        // Office days before today, newest first.
        $days = [];
        for ($day = $today->subDay(); $first && $day->toDateString() >= max($from, $first); $day = $day->subDay()) {
            $date = $day->toDateString();
            if (! $day->isWeekend() && ! $closed->has($date)) {
                $days[] = $visits->has($date);
            }
        }

        $missed = count(array_filter(array_slice($days, 0, self::MOOD_DAYS), fn (bool $visited) => ! $visited));
        $score = max(0, min(100, 100 - 20 * $missed + ($patted ? 10 : 0)));
        $away = 0;
        while ($away < count($days) && ! $days[$away]) {
            $away++;
        }

        return [
            'mood' => [
                'score' => $score,
                'level' => array_key_first(array_filter(self::MOOD_LEVELS, fn (int $floor) => $score >= $floor)),
                'patted' => $patted,
            ],
            'days_away' => $away,
        ];
    }

    /**
     * What happened today, for the pet's voice line on Home.
     *
     * @return array{time_logged: bool, leave_filed: bool, duel_waiting: bool}
     */
    private static function news(User $user): array
    {
        $start = CarbonImmutable::parse(self::today(), config('luna.office.timezone'))->utc();
        $kinds = PetEvent::query()->where('user_id', $user->id)->whereIn('kind', ['item_time', 'leave'])
            ->where('created_at', '>=', $start)->distinct()->pluck('kind');

        // What else it can talk about (slice 8), on the office clock: the next weekday off, payday, the part of the day.
        $now = TimeLog::officeNow();
        $next = CarbonImmutable::parse(self::today())->addDay();
        while ($next->isWeekend()) {
            $next = $next->addDay();
        }

        return [
            'time_logged' => $kinds->contains('item_time'),
            'leave_filed' => $kinds->contains('leave'),
            'duel_waiting' => PetDuel::query()->where('status', 'open')->where('opponent_id', $user->id)
                ->where('created_at', '>', now()->subDays(PetDuels::EXPIRE_DAYS))->exists(),
            'payday' => Payslip::query()->where('user_id', $user->id)->whereDate('released_on', self::today())->exists(),
            'day_off_tomorrow' => Holiday::query()->whereDate('date', $next->toDateString())->exists()
                || Leave::query()->where('user_id', $user->id)->whereDate('date', $next->toDateString())->exists(),
            'weekday' => $now->isoWeekday(),
            'part' => $now->hour < 12 ? 'morning' : ($now->hour < 15 ? 'afternoon' : 'evening'),
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
            // The duty line in "How it grows" is for HR and admin only.
            'duty_xp' => $user->role->atLeast(Role::Hr) ? self::XP['duty'] : null,
            'wardrobe' => Moonlings::wardrobe($user),
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
        // Pats and wardrobe unlocks give no XP, so they stay out of the XP list.
        $events = PetEvent::query()->where('user_id', $user->id)->whereNotIn('kind', ['pat', 'unlock'])
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
                'duty' => self::DUTIES[strtok($e->ref, ':')] ?? 'HR work',
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
     * The stage of many people's active moonlings in one query (the board, duel challengers).
     *
     * @param  list<int>  $userIds
     * @return array<int, int> stage by user id
     */
    public static function stages(array $userIds): array
    {
        $xp = PetEvent::query()->join('moonlings', 'moonlings.id', '=', 'pet_events.moonling_id')
            ->where('moonlings.active', true)->whereIn('pet_events.user_id', $userIds)
            ->groupBy('pet_events.user_id')
            ->selectRaw('pet_events.user_id as uid, sum(pet_events.xp) as total')->toBase()->pluck('total', 'uid');

        return collect($userIds)->mapWithKeys(fn (int $id) => [$id => self::stageFor((int) ($xp[$id] ?? 0))])->all();
    }

    /** XP of the person's active moonling. */
    private static function xp(User $user): int
    {
        return Moonlings::xp(Moonlings::active($user));
    }

    public static function stageFor(int $xp): int
    {
        return count(array_filter(self::STAGES, fn (int $at) => $xp >= $at)) - 1;
    }
}
