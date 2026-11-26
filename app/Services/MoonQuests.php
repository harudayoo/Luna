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
 * Moon quests (spec 2026-11-26-luna-moonling-style, slice 12): one-time goals that pay a dye for the moonling's
 * items. Progress is computed from what Luna already records (pats, visits, duels, names, moonlings, stages, the
 * holiday calendar), reachable in every role, never from lates. A finished quest is its dye's `dye:{key}` unlock
 * row, recorded once with a bell notice. Adding a quest is one row here (and its dye's colour in lib/pet.ts).
 */
final class MoonQuests
{
    /** In the order the Quests tab lists them. `seasonal`: only at certain times of the year. */
    public const QUESTS = [
        'say_hi' => ['title' => 'Say hi', 'goal' => 'Pat your moonling on 3 days in one week', 'dye' => 'leaf', 'seasonal' => false],
        'full_week' => ['title' => 'Full week', 'goal' => 'Visit Luna on every office day of a week', 'dye' => 'sky', 'seasonal' => false],
        'first_duel' => ['title' => 'First duel', 'goal' => 'Finish a moon duel, win or not', 'dye' => 'ruby', 'seasonal' => false],
        'name_day' => ['title' => 'Name day', 'goal' => 'Give your moonling a name', 'dye' => 'rose', 'seasonal' => false],
        'nest_builder' => ['title' => 'Nest builder', 'goal' => 'Have two moonlings in your nest', 'dye' => 'night', 'seasonal' => false],
        'shine' => ['title' => 'Shine', 'goal' => 'Raise a moonling to Full Moon', 'dye' => 'starlight', 'seasonal' => false],
        'fiesta' => ['title' => 'Fiesta eve', 'goal' => 'Visit Luna on the office day before a holiday', 'dye' => 'fiesta', 'seasonal' => true],
        'parol' => ['title' => 'Parol season', 'goal' => 'Visit Luna on an office day in December', 'dye' => 'parol', 'seasonal' => true],
    ];

    /** The quest that pays a dye, if any. */
    public static function forDye(string $dye): ?array
    {
        return collect(self::QUESTS)->first(fn (array $q) => $q['dye'] === $dye);
    }

    /**
     * Records the dye of every quest newly finished, once, with a bell notice.
     *
     * @param  list<string>  $have  what the person has unlocked already
     */
    public static function check(User $user, array $have): void
    {
        $open = collect(self::QUESTS)->reject(fn (array $q) => in_array("dye:{$q['dye']}", $have, true));
        if ($open->isEmpty()) {
            return;
        }

        foreach (self::progress($user, $open->keys()->all()) as $key => [$progress, $target]) {
            if ($target === 0 || $progress < $target) {
                continue;
            }
            $quest = self::QUESTS[$key];
            $new = PetEvent::query()->insertOrIgnore([
                'user_id' => $user->id, 'kind' => 'unlock', 'ref' => "dye:{$quest['dye']}", 'xp' => 0, 'created_at' => now(),
            ]) > 0;
            if ($new) {
                Notify::user($user, null, new LunaNotice(
                    'pet_quest', 'Quest done: '.$quest['title'],
                    'You earned the '.ucfirst($quest['dye']).' dye for your moonling’s items.',
                    route('dashboard', ['pet' => 'quests'], false), 'home',
                ));
            }
        }
    }

    /**
     * The Quests tab: every quest with its progress (capped at its target), whether it's done and its dye.
     *
     * @return list<array{key: string, title: string, goal: string, progress: int, target: int, done: bool, dye: string, seasonal: bool}>
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
                'done' => in_array("dye:{$q['dye']}", $have, true), 'dye' => $q['dye'], 'seasonal' => $q['seasonal'],
            ];
        })->values()->all();
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
        ];

        return collect($keys)->mapWithKeys(fn (string $key) => [$key => $measures[$key]()])->all();
    }
}
