<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Moonling;
use App\Models\PetEvent;
use App\Models\User;
use App\Notifications\LunaNotice;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Each person's collection of moonlings (spec 2026-11-25-luna-moonling-life, slice 6). One is active and gets the
 * new XP; the others rest in the moon nest. Eggs come from achievements, once each (by `source`), never from
 * attendance, leave or lates. Another can be raised once the active one has hatched.
 */
final class Moonlings
{
    public const KINDS = ['moon' => 'Moon', 'star' => 'Star', 'comet' => 'Comet', 'eclipse' => 'Eclipse', 'aurora' => 'Aurora', 'nova' => 'Nova'];

    /** The eggs, in the order the nest lists them, and what earns each. */
    public const EGGS = [
        'star' => 'A 30-day visit streak',
        'comet' => 'Finish 25 of your items',
        'eclipse' => 'Raise a moonling to Full Moon',
        'aurora' => 'Log time on 20 different days',
        'nova' => 'Win a weekly Moon Cup',
    ];

    /** The person's active moonling; their first `moon` one is made the first time it's needed. */
    public static function active(User $user): Moonling
    {
        return Moonling::query()->where('user_id', $user->id)->where('active', true)->first()
            ?? Moonling::query()->firstOrCreate(
                ['user_id' => $user->id, 'source' => 'start'],
                ['kind' => 'moon', 'active' => true],
            );
    }

    /**
     * Active moonlings of many people in one query (the board, duels, the cup). People who have none yet show as an
     * unnamed `moon`.
     *
     * @param  list<int>  $userIds
     * @return Collection<int, Moonling> by user id
     */
    public static function activeOf(array $userIds): Collection
    {
        return Moonling::query()->whereIn('user_id', $userIds)->where('active', true)->get()->keyBy('user_id');
    }

    /** XP of one moonling. */
    public static function xp(Moonling $moonling): int
    {
        return (int) PetEvent::query()->where('moonling_id', $moonling->id)->sum('xp');
    }

    /** Raise another of your moonlings, once the active one has hatched. */
    public static function switchTo(User $user, int $moonlingId): void
    {
        $refuse = fn (string $why) => throw ValidationException::withMessages(['moonling_id' => $why]);
        $target = Moonling::query()->where('user_id', $user->id)->find($moonlingId);
        if (! $target) {
            $refuse('That moonling isn’t in your nest.');
        }
        $current = self::active($user);
        if ($current->isNot($target) && Pet::stageFor(self::xp($current)) < 1) {
            $refuse('Your moonling has to hatch first ('.Pet::STAGES[1].' XP) before you raise another.');
        }

        Moonling::query()->where('user_id', $user->id)->update(['active' => false]);
        $target->update(['active' => true]);
    }

    /** Gives any egg the person has newly earned, with a bell notice for each. */
    public static function checkEggs(User $user): void
    {
        self::active($user); // the nest starts with their first moonling
        $have = Moonling::query()->where('user_id', $user->id)->pluck('source')->flip();

        foreach (array_keys(self::EGGS) as $kind) {
            if ($have->has($kind) || ! self::earned($user, $kind)) {
                continue;
            }
            Moonling::query()->create(['user_id' => $user->id, 'kind' => $kind, 'source' => $kind]);
            $article = in_array($kind[0], ['a', 'e', 'i', 'o', 'u'], true) ? 'An' : 'A';
            Notify::user($user, null, new LunaNotice(
                'pet_egg', 'A new egg', "{$article} {$kind} egg appeared in your moon nest.",
                route('dashboard', ['pet' => 'nest'], false), 'home',
            ));
        }
    }

    private static function earned(User $user, string $kind): bool
    {
        return match ($kind) {
            'star' => Pet::streak($user) >= 30,
            'comet' => Item::query()->where('user_id', $user->id)->where('status', 'done')->count() >= 25,
            // Only the grouped column is selected, as MySQL's ONLY_FULL_GROUP_BY requires.
            'eclipse' => PetEvent::query()->where('user_id', $user->id)->whereNotNull('moonling_id')
                ->select('moonling_id')->groupBy('moonling_id')->havingRaw('sum(xp) >= ?', [Pet::STAGES[4]])
                ->toBase()->limit(1)->get()->isNotEmpty(),
            // Item time refs are "{item}:{office date}": count the dates.
            'aurora' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'item_time')->pluck('ref')
                ->map(fn (string $ref) => substr($ref, strrpos($ref, ':') + 1))->unique()->count() >= 20,
            'nova' => in_array($user->id, PetDuels::champions(), true),
        };
    }

    /**
     * The moon nest: every moonling (the active one first), whether another can be raised, and the eggs.
     *
     * @return array{moonlings: list<array<string, mixed>>, can_switch: bool, eggs: list<array{kind: string, how: string, earned: bool}>}
     */
    public static function nest(User $user): array
    {
        $active = self::active($user);
        $moonlings = Moonling::query()->where('user_id', $user->id)->orderByDesc('active')->orderBy('id')->get();
        $xp = PetEvent::query()->whereIn('moonling_id', $moonlings->pluck('id'))->groupBy('moonling_id')
            ->selectRaw('moonling_id, sum(xp) as total')->toBase()->pluck('total', 'moonling_id');
        $stage = fn (Moonling $m) => Pet::stageFor((int) ($xp[$m->id] ?? 0));
        $sources = $moonlings->pluck('source')->flip();

        return [
            'moonlings' => $moonlings->map(fn (Moonling $m) => [
                'id' => $m->id,
                'kind' => $m->kind,
                'name' => $m->name,
                'stage' => $stage($m),
                'stage_name' => Pet::STAGE_NAMES[$stage($m)],
                'active' => $m->active,
            ])->values()->all(),
            'can_switch' => $stage($active) >= 1,
            'eggs' => collect(self::EGGS)->map(fn (string $how, string $kind) => [
                'kind' => $kind, 'how' => $how, 'earned' => $sources->has($kind),
            ])->values()->all(),
        ];
    }
}
