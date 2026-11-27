<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Moonling;
use App\Models\PetDuel;
use App\Models\PetEvent;
use App\Models\User;
use App\Notifications\LunaNotice;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Each person's collection of moonlings (spec 2026-11-25-luna-moonling-life, slice 6). One is active and gets the
 * new XP; the others rest in the moon nest. Eggs come from achievements, once each (by `source`), never from
 * attendance, leave or lates. Any other can be raised at any time, eggs included; each keeps its own XP.
 */
final class Moonlings
{
    public const KINDS = [
        'moon' => 'Moon', 'star' => 'Star', 'comet' => 'Comet', 'eclipse' => 'Eclipse', 'aurora' => 'Aurora', 'nova' => 'Nova',
        // Spec 2026-11-26-luna-moonling-collection, slice 15; the last three for Luna Orchid and Orchid City.
        'sun' => 'Sun', 'planet' => 'Planet', 'meteor' => 'Meteor', 'galaxy' => 'Galaxy',
        'orchid' => 'Orchid', 'moonflower' => 'Moonflower', 'citylight' => 'Citylight',
    ];

    /** The eggs, in the order the nest lists them, and what earns each. */
    public const EGGS = [
        'star' => 'A 30-day visit streak',
        'comet' => 'Finish 25 of your items',
        'eclipse' => 'Raise a moonling to Full Moon',
        'aurora' => 'Work on 20 different days',
        'nova' => 'Win a weekly Moon Cup',
        'sun' => 'Visit Luna on 100 office days',
        'planet' => 'Raise 3 moonlings to Bright',
        'meteor' => 'Win 50 moon duels',
        'galaxy' => 'Finish every moon quest (not the seasonal ones)',
        'orchid' => 'Pat your moonling on 30 days',
        'moonflower' => 'Have 5 moonlings',
        'citylight' => 'Visit Luna in 6 different months',
    ];

    /**
     * The wardrobe's shades: fixed art colours, the same in both themes (spec 2026-11-26-luna-moonling-style,
     * slice 9; drawn in lib/pet.ts paletteStyle). The open ones first; SHADE_UNLOCKS says what unlocks the rest.
     */
    public const PALETTES = [
        'classic', 'dusk', 'dawn', 'tide', 'mist', 'mint', 'coral', 'lilac',
        'sakura', 'ember', 'frost', 'cocoa', 'midnight', 'gold', 'nebula', 'ocean', 'peach', 'prism',
    ];

    /** Shades that are unlocked (recorded as `shade:{key}`), and how. Reachable in every role. */
    public const SHADE_UNLOCKS = [
        'sakura' => 'Pat your moonling on 10 days',
        'ember' => 'Reach a 20-day visit streak',
        'frost' => 'Win 10 moon duels',
        'cocoa' => 'Earn 500 XP across your moonlings',
        'midnight' => 'Hatch 3 moonlings',
        'gold' => 'Raise a moonling to Full Moon',
        'nebula' => 'Win a weekly Moon Cup',
        // Slice 17; paid by moon quests in slice 18 (spec 2026-11-26-luna-moonling-collection).
        'ocean' => 'Wear something in every spot (a moon quest)',
        'peach' => 'Duel 5 different people (a moon quest)',
        'prism' => 'Unlock every other shade',
    ];

    /** Where items go (slice 10): one item in each. */
    public const SLOTS = ['head', 'face', 'neck', 'back', 'hand'];

    /**
     * The wardrobe's items: name (as the wardrobe shows it), slot and what unlocks each (`how` null: open from the start). The Moon Cup crown is worn
     * automatically, not picked.
     */
    public const WEAR = [
        'star_clip' => ['name' => 'Star clip', 'slot' => 'head', 'how' => 'Win 5 moon duels'],
        'comet_trail' => ['name' => 'Comet trail', 'slot' => 'neck', 'how' => 'Win 15 moon duels'],
        'halo' => ['name' => 'Halo', 'slot' => 'head', 'how' => 'Win 30 moon duels'],
        'scarf' => ['name' => 'Scarf', 'slot' => 'neck', 'how' => 'Reach a 10-day visit streak'],
        'bow' => ['name' => 'Bow', 'slot' => 'head', 'how' => 'Give your moonling a name'],
        'propeller' => ['name' => 'Propeller cap', 'slot' => 'head', 'how' => 'Reach a 5-day visit streak'],
        'glasses' => ['name' => 'Round glasses', 'slot' => 'face', 'how' => null],
        'wings' => ['name' => 'Wings', 'slot' => 'back', 'how' => 'Hatch a moonling'],
        'cape' => ['name' => 'Cape', 'slot' => 'back', 'how' => 'Earn 200 XP across your moonlings'],
        'balloon' => ['name' => 'Balloon', 'slot' => 'hand', 'how' => null],
        'wand' => ['name' => 'Wand', 'slot' => 'hand', 'how' => 'Win a moon duel'],
        'lantern' => ['name' => 'Lantern', 'slot' => 'hand', 'how' => 'Raise a moonling to Bright'],
        // Spec 2026-11-26-luna-moonling-collection, slice 16.
        'jetpack' => ['name' => 'Jetpack', 'slot' => 'back', 'how' => 'Reach a 15-day visit streak'],
        'umbrella' => ['name' => 'Umbrella', 'slot' => 'hand', 'how' => 'Visit on 5 office days in the rainy season (June–October)'],
        'flower_crown' => ['name' => 'Flower crown', 'slot' => 'head', 'how' => null],
        'bowtie' => ['name' => 'Bowtie', 'slot' => 'neck', 'how' => 'Finish 3 moon quests'],
        'orchid_pin' => ['name' => 'Orchid pin', 'slot' => 'head', 'how' => null],
        'coffee' => ['name' => 'Coffee mug', 'slot' => 'hand', 'how' => 'Visit before 9:00 on 10 office days'],
        'headphones' => ['name' => 'Headphones', 'slot' => 'head', 'how' => 'Finish 5 weekly quests'],
        'kite' => ['name' => 'Kite', 'slot' => 'hand', 'how' => 'Win 10 moon duels'],
        'monocle' => ['name' => 'Monocle', 'slot' => 'face', 'how' => 'Raise a moonling to Full Moon'],
    ];

    /**
     * Dyes for items (recorded as `dye:{key}` when unlocked). Every item has its own colour, `default`, which the
     * shade never changes (slice 12). The open ones first; the rest are paid by moon quests (MoonQuests), the
     * seasonal ones last.
     */
    public const DYES = [
        'default', 'sun', 'ruby', 'leaf', 'sky', 'rose', 'night', 'starlight', 'cloud', 'berry',
        'gold', 'silver', 'bronze', 'fiesta', 'parol', 'pumpkin', 'pine', 'heart',
    ];

    /** Dyes earned by placing in a weekly Moon Cup (slice 17), not by a quest. */
    public const DYE_UNLOCKS = [
        'gold' => 'Win a weekly Moon Cup',
        'silver' => 'Place 2nd in a weekly Moon Cup',
        'bronze' => 'Place 3rd in a weekly Moon Cup',
    ];

    public const OPEN_DYES = ['default', 'sun'];

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

    /** Raise another of your moonlings, egg or hatched (spec 2026-11-27-luna-item-icons-switch-eggs); XP stays with each. */
    public static function switchTo(User $user, int $moonlingId): void
    {
        $refuse = fn (string $why) => throw ValidationException::withMessages(['moonling_id' => $why]);
        $target = Moonling::query()->where('user_id', $user->id)->find($moonlingId);
        if (! $target) {
            $refuse('That moonling isn’t in your nest.');
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

    /**
     * Records anything in the wardrobe the person has newly unlocked, once (a 0-XP `unlock` row; the unique key keeps
     * it once), so it stays theirs even when a streak later breaks. Items are recorded by key, shades as
     * `shade:{key}`, dyes as `dye:{key}`. Each measure is counted at most once per call, and only when something still needs it.
     */
    public static function checkUnlocks(User $user): void
    {
        $have = self::unlocked($user);
        $memo = [];
        $m = function (string $key, callable $count) use (&$memo) {
            return $memo[$key] ??= $count();
        };
        $wins = fn () => $m('wins', fn () => PetDuel::query()->where('status', 'done')->where('winner_id', $user->id)->count());
        $streak = fn () => $m('streak', fn () => Pet::streak($user));
        // XP of each of the person's moonlings.
        $xps = fn () => $m('xps', fn () => PetEvent::query()->where('user_id', $user->id)->whereNotNull('moonling_id')
            ->groupBy('moonling_id')->selectRaw('moonling_id, sum(xp) as total')->toBase()->pluck('total')
            ->map(fn ($xp) => (int) $xp));
        $stages = fn () => $xps()->map(fn (int $xp) => Pet::stageFor($xp));
        $hatched = fn () => $stages()->filter(fn (int $s) => $s >= 1)->count();
        $placing = fn () => $m('placing', fn () => PetDuels::placing($user->id) ?? 0);
        $visits = fn () => $m('visits', fn () => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->pluck('ref'));
        $pats = fn () => $m('pats', fn () => PetEvent::query()->where('user_id', $user->id)->where('kind', 'pat')->count());

        $rules = [
            'star_clip' => fn () => $wins() >= 5,
            'comet_trail' => fn () => $wins() >= 15,
            'halo' => fn () => $wins() >= 30,
            'scarf' => fn () => $streak() >= 10,
            'bow' => fn () => Moonling::query()->where('user_id', $user->id)->whereNotNull('name')->exists(),
            'propeller' => fn () => $streak() >= 5,
            'wings' => fn () => $hatched() >= 1,
            'cape' => fn () => $xps()->sum() >= 200,
            'wand' => fn () => $wins() >= 1,
            'lantern' => fn () => $stages()->contains(fn (int $s) => $s >= 3),
            'jetpack' => fn () => $streak() >= 15,
            // Visit refs are office dates; the rainy season is June to October.
            'umbrella' => fn () => $visits()->filter(fn (string $d) => in_array((int) substr($d, 5, 2), [6, 7, 8, 9, 10], true))->count() >= 5,
            'bowtie' => function () use (&$have) {
                return collect(MoonQuests::QUESTS)->filter(fn (array $q) => in_array(MoonQuests::ref($q), $have, true))->count() >= 3;
            },
            // Visits made before 9:00 on the office clock.
            'coffee' => fn () => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->get(['created_at'])
                ->filter(fn (PetEvent $e) => $e->created_at?->timezone(config('luna.office.timezone'))->hour < 9)->count() >= 10,
            'headphones' => fn () => PetEvent::query()->where('user_id', $user->id)->where('kind', 'weekly')->count() >= 5,
            'kite' => fn () => $wins() >= 10,
            'monocle' => fn () => $stages()->contains(4),
            'dye:gold' => fn () => $placing() === 1,
            'dye:silver' => fn () => $placing() === 2,
            'dye:bronze' => fn () => $placing() === 3,
            'shade:sakura' => fn () => $pats() >= 10,
            'shade:ember' => fn () => $streak() >= 20,
            'shade:frost' => fn () => $wins() >= 10,
            'shade:cocoa' => fn () => $xps()->sum() >= 500,
            'shade:midnight' => fn () => $hatched() >= 3,
            'shade:gold' => fn () => $stages()->contains(4),
            'shade:nebula' => fn () => in_array($user->id, PetDuels::champions(), true),
            // Last, and by reference, so it sees the shades unlocked just above in this same pass.
            'shade:prism' => function () use (&$have) {
                return collect(array_keys(self::SHADE_UNLOCKS))->reject(fn ($k) => $k === 'prism')
                    ->every(fn ($k) => in_array("shade:{$k}", $have, true));
            },
        ];

        $new = [];
        foreach ($rules as $ref => $earned) {
            if (! in_array($ref, $have, true) && $earned()) {
                if (PetEvent::query()->insertOrIgnore([
                    'user_id' => $user->id, 'kind' => 'unlock', 'ref' => $ref, 'xp' => 0, 'created_at' => now(),
                ]) > 0) {
                    $new[] = $ref;
                }
                $have[] = $ref;
            }
        }
        self::tellUnlocked($user, $new);

        // Dyes come from moon quests (slice 12).
        MoonQuests::check($user, $have);
    }

    /**
     * One bell notice for everything a check just unlocked (slice 13), so a check that unlocks several things at once
     * (the first one after a deploy, say) sends one notice, not a burst: "The Star clip and the Frost shade are ready
     * to wear." Links to the panel's "Your pet" tab, where the wardrobe is.
     *
     * @param  list<string>  $refs  item keys, `shade:{key}` and `dye:{key}` (the Moon Cup's metallic dyes)
     */
    private static function tellUnlocked(User $user, array $refs): void
    {
        if ($refs === []) {
            return;
        }
        $names = array_map(fn (string $ref) => match (true) {
            str_starts_with($ref, 'shade:') => 'the '.ucfirst(substr($ref, 6)).' shade',
            str_starts_with($ref, 'dye:') => 'the '.ucfirst(substr($ref, 4)).' dye',
            default => 'the '.self::WEAR[$ref]['name'],
        }, $refs);
        $list = count($names) === 1 ? $names[0] : implode(', ', array_slice($names, 0, -1)).' and '.end($names);

        Notify::user($user, null, new LunaNotice(
            'pet_unlock', 'New in your wardrobe',
            ucfirst($list).(count($names) === 1 ? ' is' : ' are').' ready to wear.',
            route('dashboard', ['pet' => 'pet'], false), 'home',
        ));
    }

    /** Whether a dye can be used: open from the start, or unlocked (by its quest). */
    private static function dyeOpen(string $dye, array $unlocked): bool
    {
        return in_array($dye, self::OPEN_DYES, true) || in_array("dye:{$dye}", $unlocked, true);
    }

    /** What unlocks a dye: its quest's goal; null for an open one. */
    private static function dyeHow(string $dye): ?string
    {
        if (in_array($dye, self::OPEN_DYES, true)) {
            return null;
        }
        if (isset(self::DYE_UNLOCKS[$dye])) {
            return self::DYE_UNLOCKS[$dye];
        }
        $quest = MoonQuests::forDye($dye);

        return $quest ? "{$quest['title']}: {$quest['goal']}" : 'Finish a moon quest';
    }

    /** Whether a shade can be worn: open from the start, or unlocked. */
    private static function shadeOpen(string $shade, array $unlocked): bool
    {
        return ! isset(self::SHADE_UNLOCKS[$shade]) || in_array("shade:{$shade}", $unlocked, true);
    }

    /** @return list<string> what the person has unlocked: item keys, `shade:{key}` and `dye:{key}` */
    public static function unlocked(User $user): array
    {
        return PetEvent::query()->where('user_id', $user->id)->where('kind', 'unlock')->pluck('ref')->all();
    }

    /**
     * Puts a shade, items and/or dyes on one of your moonlings: an open or unlocked shade, only open or unlocked
     * items, one per slot, and open or unlocked dyes on known items (merged into the moonling's dyes).
     *
     * @param  array{palette?: string, wear?: list<string>, dyes?: array<string, string>}  $data
     */
    public static function dress(User $user, Moonling $moonling, array $data): void
    {
        abort_unless($moonling->user_id === $user->id, 404);

        $unlocked = self::unlocked($user);
        if (array_key_exists('palette', $data)) {
            if (! in_array($data['palette'], self::PALETTES, true)) {
                throw ValidationException::withMessages(['palette' => 'Pick one of the shades.']);
            }
            if (! self::shadeOpen($data['palette'], $unlocked)) {
                throw ValidationException::withMessages(['palette' => self::SHADE_UNLOCKS[$data['palette']].' to unlock that shade.']);
            }
        }
        if (array_key_exists('wear', $data)) {
            $wear = array_values(array_unique($data['wear']));
            foreach ($wear as $item) {
                if (! isset(self::WEAR[$item])) {
                    throw ValidationException::withMessages(['wear' => 'That isn’t something your moonling can wear.']);
                }
                if (self::WEAR[$item]['how'] !== null && ! in_array($item, $unlocked, true)) {
                    throw ValidationException::withMessages(['wear' => self::WEAR[$item]['how'].' to unlock that.']);
                }
            }
            $slots = array_map(fn (string $item) => self::WEAR[$item]['slot'], $wear);
            if (count($slots) !== count(array_unique($slots))) {
                throw ValidationException::withMessages(['wear' => 'One item on each spot: head, face, neck, back and hand.']);
            }
            $data['wear'] = $wear;
        }
        if (array_key_exists('dyes', $data)) {
            foreach ($data['dyes'] as $item => $dye) {
                if (! isset(self::WEAR[$item]) || ! in_array($dye, self::DYES, true)) {
                    throw ValidationException::withMessages(['dyes' => 'Pick one of the dyes for one of the items.']);
                }
                if (! self::dyeOpen($dye, $unlocked)) {
                    throw ValidationException::withMessages(['dyes' => self::dyeHow($dye).' to unlock that dye.']);
                }
            }
            $data['dyes'] = array_merge($moonling->dyes, $data['dyes']);
        }

        $moonling->update(array_intersect_key($data, ['palette' => 1, 'wear' => 1, 'dyes' => 1]));
        // What it wears can finish a quest ("Dressed up", slice 18 of the collection spec).
        self::checkUnlocks($user);
    }

    /**
     * The wardrobe in the panel: every shade, item and dye, with whether you have it and how to unlock it (`how` is
     * null for an open one).
     *
     * @return array{palettes: list<array{key: string, unlocked: bool, how: string|null}>, items: list<array{key: string, slot: string, how: string|null, unlocked: bool}>, dyes: list<array{key: string, unlocked: bool, how: string|null}>}
     */
    public static function wardrobe(User $user): array
    {
        $unlocked = self::unlocked($user);

        return [
            'palettes' => array_map(fn (string $p) => [
                'key' => $p, 'unlocked' => self::shadeOpen($p, $unlocked), 'how' => self::SHADE_UNLOCKS[$p] ?? null,
            ], self::PALETTES),
            'items' => collect(self::WEAR)->map(fn (array $w, string $key) => [
                'key' => $key, 'slot' => $w['slot'], 'how' => $w['how'],
                'unlocked' => $w['how'] === null || in_array($key, $unlocked, true),
            ])->values()->all(),
            'dyes' => array_map(fn (string $key) => [
                'key' => $key, 'unlocked' => self::dyeOpen($key, $unlocked), 'how' => self::dyeHow($key),
            ], self::DYES),
        ];
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
            // Item time and duty refs end in ":{office date}": count the dates (duty: HR work, slice 11).
            'aurora' => PetEvent::query()->where('user_id', $user->id)->whereIn('kind', ['item_time', 'duty'])->pluck('ref')
                ->map(fn (string $ref) => substr($ref, strrpos($ref, ':') + 1))->unique()->count() >= 20,
            'nova' => in_array($user->id, PetDuels::champions(), true),
            'sun' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->count() >= 100,
            'planet' => PetEvent::query()->where('user_id', $user->id)->whereNotNull('moonling_id')
                ->select('moonling_id')->groupBy('moonling_id')->havingRaw('sum(xp) >= ?', [Pet::STAGES[3]])
                ->toBase()->get()->count() >= 3,
            'meteor' => PetDuel::query()->where('status', 'done')->where('winner_id', $user->id)->count() >= 50,
            'galaxy' => collect(MoonQuests::QUESTS)->reject(fn (array $q) => $q['seasonal'])
                ->every(fn (array $q) => PetEvent::query()->where('user_id', $user->id)->where('kind', 'unlock')
                    ->where('ref', MoonQuests::ref($q))->exists()),
            'orchid' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'pat')->count() >= 30,
            'moonflower' => Moonling::query()->where('user_id', $user->id)->count() >= 5,
            // Visit refs are office dates: count the distinct months.
            'citylight' => PetEvent::query()->where('user_id', $user->id)->where('kind', 'visit')->pluck('ref')
                ->map(fn (string $d) => substr($d, 0, 7))->unique()->count() >= 6,
        };
    }

    /**
     * The moon nest: every moonling (the active one first), whether another can be raised, and the eggs.
     *
     * @return array{moonlings: list<array<string, mixed>>, eggs: list<array{kind: string, how: string, earned: bool}>}
     */
    public static function nest(User $user): array
    {
        self::active($user); // the nest starts with their first moonling
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
                'palette' => $m->palette,
                'wear' => $m->wear,
                'dyes' => $m->dyes,
            ])->values()->all(),
            'eggs' => collect(self::EGGS)->map(fn (string $how, string $kind) => [
                'kind' => $kind, 'how' => $how, 'earned' => $sources->has($kind),
            ])->values()->all(),
        ];
    }
}
