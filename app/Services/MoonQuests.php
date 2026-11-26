<?php

namespace App\Services;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Notifications\LunaNotice;
use Carbon\CarbonImmutable;

/**
 * Moon quests (spec 2026-11-26-luna-moonling-style, slice 12; spec 2026-11-26-luna-moonling-collection, slice 18).
 * One-time goals that pay a dye for the moonling's items or a shade, and three weekly quests that pay a little XP and
 * start again every Monday. Progress is computed from what Luna already records (pats, visits, duels, names,
 * moonlings, stages, what they wear, the holiday calendar), reachable in every role, never from lates. A finished
 * one-time quest is its reward's unlock row (`dye:{key}` or `shade:{key}`), recorded once with a bell notice; a
 * finished weekly quest is a `weekly` award (ref `{quest}:{monday}`). Adding a quest is one row here.
 */
final class MoonQuests
{
    /**
     * In the order the Quests tab lists them; each pays a `dye` or a `shade`. `seasonal`: only at certain times of the
     * year.
     */
    public const QUESTS = [
        'say_hi' => ['title' => 'Say hi', 'goal' => 'Pat your moonling on 3 days in one week', 'dye' => 'leaf', 'seasonal' => false],
        'full_week' => ['title' => 'Full week', 'goal' => 'Visit Luna on every office day of a week', 'dye' => 'sky', 'seasonal' => false],
        'first_duel' => ['title' => 'First duel', 'goal' => 'Finish a moon duel, win or not', 'dye' => 'ruby', 'seasonal' => false],
        'name_day' => ['title' => 'Name day', 'goal' => 'Give your moonling a name', 'dye' => 'rose', 'seasonal' => false],
        'nest_builder' => ['title' => 'Nest builder', 'goal' => 'Have two moonlings in your nest', 'dye' => 'night', 'seasonal' => false],
        'shine' => ['title' => 'Shine', 'goal' => 'Raise a moonling to Full Moon', 'dye' => 'starlight', 'seasonal' => false],
        // Slice 18 of the collection spec.
        'social' => ['title' => 'Social butterfly', 'goal' => 'Duel 5 different people', 'shade' => 'peach', 'seasonal' => false],
        'full_outfit' => ['title' => 'Dressed up', 'goal' => 'Wear something in every spot: head, face, neck, back and hand', 'shade' => 'ocean', 'seasonal' => false],
        'patter' => ['title' => 'Pat pal', 'goal' => 'Pat your moonling on 20 days', 'dye' => 'cloud', 'seasonal' => false],
        'mondays' => ['title' => 'Monday regular', 'goal' => 'Visit Luna on 3 Mondays in a row', 'dye' => 'berry', 'seasonal' => false],
        'fiesta' => ['title' => 'Fiesta eve', 'goal' => 'Visit Luna on the office day before a holiday', 'dye' => 'fiesta', 'seasonal' => true],
        'parol' => ['title' => 'Parol season', 'goal' => 'Visit Luna on an office day in December', 'dye' => 'parol', 'seasonal' => true],
        // Holiday dyes (slice 17 of the collection spec).
        'pumpkin' => ['title' => 'Pumpkin week', 'goal' => 'Visit Luna on an office day from October 25 to 31', 'dye' => 'pumpkin', 'seasonal' => true],
        'pine' => ['title' => 'Christmas eve week', 'goal' => 'Visit Luna on an office day from December 20 to 24', 'dye' => 'pine', 'seasonal' => true],
        'heart' => ['title' => 'Heart week', 'goal' => 'Visit Luna on an office day from February 10 to 14', 'dye' => 'heart', 'seasonal' => true],
    ];

    /** The weekly quests (slice 18): each pays WEEKLY_XP once an office week. */
    public const WEEKLY = [
        'visits' => ['title' => 'Visit 4 office days', 'target' => 4],
        'duel' => ['title' => 'Finish a duel', 'target' => 1],
        'pats' => ['title' => 'Pat on 2 days', 'target' => 2],
    ];

    public const WEEKLY_XP = 5;

    /** A quest's reward as an unlock ref: `dye:{key}` or `shade:{key}`. */
    public static function ref(array $quest): string
    {
        return isset($quest['dye']) ? "dye:{$quest['dye']}" : "shade:{$quest['shade']}";
    }

    /** The quest that pays a dye, if any. */
    public static function forDye(string $dye): ?array
    {
        return collect(self::QUESTS)->first(fn (array $q) => ($q['dye'] ?? null) === $dye);
    }

    /**
     * Records the reward of every quest newly finished, once, with a bell notice, and pays any weekly quest newly
     * finished this week.
     *
     * @param  list<string>  $have  what the person has unlocked already
     */
    public static function check(User $user, array $have): void
    {
        self::checkWeekly($user);

        $open = collect(self::QUESTS)->reject(fn (array $q) => in_array(self::ref($q), $have, true));
        if ($open->isEmpty()) {
            return;
        }

        foreach (self::progress($user, $open->keys()->all()) as $key => [$progress, $target]) {
            if ($target === 0 || $progress < $target) {
                continue;
            }
            $quest = self::QUESTS[$key];
            $new = PetEvent::query()->insertOrIgnore([
                'user_id' => $user->id, 'kind' => 'unlock', 'ref' => self::ref($quest), 'xp' => 0, 'created_at' => now(),
            ]) > 0;
            if ($new) {
                $reward = isset($quest['dye'])
                    ? 'the '.ucfirst($quest['dye']).' dye for your moonling’s items'
                    : 'the '.ucfirst($quest['shade']).' shade for your moonling';
                Notify::user($user, null, new LunaNotice(
                    'pet_quest', 'Quest done: '.$quest['title'], "You earned {$reward}.",
                    route('dashboard', ['pet' => 'quests'], false), 'home',
                ));
            }
        }
    }

    /**
     * The Quests tab: every one-time quest with its progress (capped at its target), whether it's done and its
     * reward (a dye or a shade).
     *
     * @return list<array{key: string, title: string, goal: string, progress: int, target: int, done: bool, dye: string|null, shade: string|null, seasonal: bool}>
     */
    public static function list(User $user): array
    {
        // Quests are checked after each award; check here too, so one finished another way (an egg hatched into a
        // second moonling, say) shows as done the moment the tab opens.
        self::check($user, Moonlings::unlocked($user));
        $have = Moonlings::unlocked($user);
        $progress = self::progress($user, array_keys(self::QUESTS));

        return collect(self::QUESTS)->map(function (array $q, string $key) use ($have, $progress) {
            [$done, $target] = $progress[$key];

            return [
                'key' => $key, 'title' => $q['title'], 'goal' => $q['goal'],
                'progress' => min($done, $target), 'target' => $target,
                'done' => in_array(self::ref($q), $have, true),
                'dye' => $q['dye'] ?? null, 'shade' => $q['shade'] ?? null, 'seasonal' => $q['seasonal'],
            ];
        })->values()->all();
    }

    /**
     * This week's quests for the Quests tab, the quest streak, and when they start again.
     *
     * @return array{quests: list<array{key: string, title: string, progress: int, target: int, done: bool, xp: int}>, streak: int, resets: string}
     */
    public static function weekly(User $user): array
    {
        $monday = self::monday();
        $progress = self::weeklyProgress($user, $monday);
        $paid = PetEvent::query()->where('user_id', $user->id)->where('kind', 'weekly')
            ->where('ref', 'like', '%:'.$monday->toDateString())->pluck('ref')->all();

        return [
            'quests' => collect(self::WEEKLY)->map(fn (array $w, string $key) => [
                'key' => $key, 'title' => $w['title'], 'progress' => min($progress[$key], $w['target']),
                'target' => $w['target'], 'done' => in_array("{$key}:{$monday->toDateString()}", $paid, true),
                'xp' => self::WEEKLY_XP,
            ])->values()->all(),
            'streak' => self::streak($user),
            'resets' => $monday->addWeek()->toDateString(),
        ];
    }

    /** Office weeks in a row with all three weekly quests done (this week counts once it's complete). */
    public static function streak(User $user): int
    {
        return self::streaks([$user->id])[$user->id];
    }

    /**
     * `streak` for many people at once (the board): one query.
     *
     * @param  list<int>  $userIds
     * @return array<int, int>
     */
    public static function streaks(array $userIds): array
    {
        $since = self::monday()->subWeeks(60)->toDateString();
        $done = PetEvent::query()->whereIn('user_id', $userIds)->where('kind', 'weekly')->toBase()->get(['user_id', 'ref'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->map(fn ($r) => substr($r->ref, strrpos($r->ref, ':') + 1))
                ->filter(fn (string $d) => $d >= $since)->countBy()
                ->filter(fn (int $n) => $n >= count(self::WEEKLY)));

        return collect($userIds)->mapWithKeys(function (int $id) use ($done) {
            $full = $done[$id] ?? collect();
            $week = self::monday();
            if (! $full->has($week->toDateString())) {
                $week = $week->subWeek();
            }
            $streak = 0;
            while ($full->has($week->toDateString())) {
                $streak++;
                $week = $week->subWeek();
            }

            return [$id => $streak];
        })->all();
    }

    /** Pays each weekly quest finished this week, once (through Pet::award, so it's XP like any other). */
    private static function checkWeekly(User $user): void
    {
        $monday = self::monday();
        $paid = PetEvent::query()->where('user_id', $user->id)->where('kind', 'weekly')
            ->where('ref', 'like', '%:'.$monday->toDateString())->pluck('ref')->all();
        $todo = collect(self::WEEKLY)->reject(fn (array $w, string $key) => in_array("{$key}:{$monday->toDateString()}", $paid, true));
        if ($todo->isEmpty()) {
            return;
        }

        $progress = self::weeklyProgress($user, $monday);
        foreach ($todo as $key => $w) {
            if ($progress[$key] >= $w['target']) {
                Pet::award($user, 'weekly', "{$key}:{$monday->toDateString()}", self::WEEKLY_XP);
            }
        }
    }

    /** @return array{visits: int, duel: int, pats: int} this office week's counts */
    private static function weeklyProgress(User $user, CarbonImmutable $monday): array
    {
        $friday = $monday->addDays(4)->toDateString();
        $from = CarbonImmutable::parse($monday->toDateString(), config('luna.office.timezone'))->utc();
        $between = [$monday->toDateString(), $friday];

        return [
            'visits' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->whereBetween('ref', $between)->count(),
            'duel' => PetDuel::query()->where('status', 'done')
                ->where(fn ($q) => $q->where('challenger_id', $user->id)->orWhere('opponent_id', $user->id))
                ->where('answered_at', '>=', $from->toDateTimeString())
                ->where('answered_at', '<', $from->addWeek()->toDateTimeString())->count(),
            'pats' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'pat')->whereBetween('ref', $between)->count(),
        ];
    }

    private static function monday(): CarbonImmutable
    {
        return CarbonImmutable::parse(Pet::today())->startOfWeek(CarbonImmutable::MONDAY);
    }

    /**
     * [progress, target] for each quest asked for. Weekly ones look at this office week (Mon–Fri).
     *
     * @param  list<string>  $keys
     * @return array<string, array{int, int}>
     */
    private static function progress(User $user, array $keys): array
    {
        $today = CarbonImmutable::parse(Pet::today());
        $monday = $today->startOfWeek(CarbonImmutable::MONDAY);
        $friday = $monday->addDays(4);
        // Seasonal quests count only a visit on an office day (not a weekend or a holiday).
        $visitedToday = fn () => ! $today->isWeekend()
            && ! Holiday::query()->whereDate('date', $today->toDateString())->exists()
            && PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->where('ref', $today->toDateString())->exists();

        $measures = [
            'say_hi' => fn () => [PetEvent::query()->where('user_id', $user->id)->where('kind', 'pat')
                ->whereBetween('ref', [$monday->toDateString(), $friday->toDateString()])->count(), 3],
            'full_week' => function () use ($user, $monday, $friday) {
                // Office days this week: Mon–Fri less holidays and the person's own leave.
                $closed = Holiday::query()->whereBetween('date', [$monday->toDateString(), $friday->toDateString()])->toBase()->pluck('date')
                    ->merge(Leave::query()->where('user_id', $user->id)->whereBetween('date', [$monday->toDateString(), $friday->toDateString()])->toBase()->pluck('date'))
                    ->map(fn ($d) => substr((string) $d, 0, 10))->flip();
                $days = collect(range(0, 4))->map(fn (int $i) => $monday->addDays($i)->toDateString())
                    ->reject(fn (string $d) => $closed->has($d));
                $visited = PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')
                    ->whereIn('ref', $days->all())->count();

                return [$visited, $days->count()];
            },
            'first_duel' => fn () => [PetDuel::query()->where('status', 'done')
                ->where(fn ($q) => $q->where('challenger_id', $user->id)->orWhere('opponent_id', $user->id))->exists() ? 1 : 0, 1],
            'name_day' => fn () => [Moonling::query()->where('user_id', $user->id)->whereNotNull('name')->exists() ? 1 : 0, 1],
            'nest_builder' => fn () => [Moonling::query()->where('user_id', $user->id)->count(), 2],
            'shine' => fn () => [(int) (PetEvent::query()->where('user_id', $user->id)->whereNotNull('moonling_id')
                ->groupBy('moonling_id')->selectRaw('sum(xp) as total')->toBase()->pluck('total')
                ->map(fn ($xp) => Pet::stageFor((int) $xp))->max() ?? 0), 4],
            // Different people you've finished a duel with, either side.
            'social' => fn () => [PetDuel::query()->where('status', 'done')
                ->where(fn ($q) => $q->where('challenger_id', $user->id)->orWhere('opponent_id', $user->id))
                ->toBase()->get(['challenger_id', 'opponent_id'])
                ->map(fn ($d) => $d->challenger_id === $user->id ? $d->opponent_id : $d->challenger_id)->unique()->count(), 5],
            // The most spots any one of your moonlings has something in.
            'full_outfit' => fn () => [(int) (Moonling::query()->where('user_id', $user->id)->get(['wear'])
                ->map(fn (Moonling $m) => collect($m->wear)->filter(fn (string $w) => isset(Moonlings::WEAR[$w]))
                    ->map(fn (string $w) => Moonlings::WEAR[$w]['slot'])->unique()->count())->max() ?? 0),
                count(Moonlings::SLOTS)],
            'patter' => fn () => [PetEvent::query()->where('user_id', $user->id)->where('kind', 'pat')->count(), 20],
            // The longest run of Mondays in a row with a visit.
            'mondays' => function () use ($user) {
                $mondays = PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->pluck('ref')
                    ->filter(fn (string $d) => CarbonImmutable::parse($d)->isMonday())->sort()->values();
                $best = $run = 0;
                $last = null;
                foreach ($mondays as $d) {
                    $run = $last && CarbonImmutable::parse($last)->addWeek()->toDateString() === $d ? $run + 1 : 1;
                    $best = max($best, $run);
                    $last = $d;
                }

                return [$best, 3];
            },
            'fiesta' => function () use ($today, $visitedToday) {
                // The next office day (weekends skipped) is a holiday.
                $next = $today->addDay();
                while ($next->isWeekend()) {
                    $next = $next->addDay();
                }
                $eve = Holiday::query()->whereDate('date', $next->toDateString())->exists();

                return [$eve && $visitedToday() ? 1 : 0, 1];
            },
            'parol' => fn () => [$today->month === 12 && $visitedToday() ? 1 : 0, 1],
            'pumpkin' => fn () => [$today->month === 10 && $today->day >= 25 && $visitedToday() ? 1 : 0, 1],
            'pine' => fn () => [$today->month === 12 && $today->day >= 20 && $today->day <= 24 && $visitedToday() ? 1 : 0, 1],
            'heart' => fn () => [$today->month === 2 && $today->day >= 10 && $today->day <= 14 && $visitedToday() ? 1 : 0, 1],
        ];

        return collect($keys)->mapWithKeys(fn (string $key) => [$key => $measures[$key]()])->all();
    }
}
