/** The pet on Home (spec 2026-11-24-luna-pet). Stages match App\Services\Pet::STAGES. */
export type Pet = {
    name: string | null;
    /** The moonling being raised (slice 6): its id, kind, and wardrobe (slice 7). */
    moonling_id: number;
    kind: MoonlingKind;
    palette: Palette;
    wear: WearItem[];
    dyes: Dyes;
    public: boolean;
    xp: number;
    stage: number;
    stage_name: string;
    next_at: number | null;
    streak: number;
    fed_today: boolean;
    /** Last week's Moon Cup champion (App\Services\PetDuels::champions). */
    crown: boolean;
    /** Private to the owner (App\Services\Pet::state): never on the board or in duels. */
    mood: { score: number; level: MoodLevel; patted: boolean };
    /** Office days missed in a row right before today. */
    days_away: number;
    /** What happened today, for the voice line on Home. */
    today: {
        time_logged: boolean;
        leave_filed: boolean;
        duel_waiting: boolean;
        /** Slice 8: a payslip of yours released today; the next weekday is a holiday or your leave. */
        payday: boolean;
        day_off_tomorrow: boolean;
        /** Office clock: 1 = Monday … 7 = Sunday, and the part of the day. */
        weekday: number;
        part: 'morning' | 'afternoon' | 'evening';
    };
};

/** App\Services\Moonlings::KINDS: what a moonling is, and its name. */
export const KINDS = {
    moon: 'Moon',
    star: 'Star',
    comet: 'Comet',
    eclipse: 'Eclipse',
    aurora: 'Aurora',
    nova: 'Nova',
} as const;

export type MoonlingKind = keyof typeof KINDS;

/** The moon nest (App\Services\Moonlings::nest), loaded when its tab opens. */
export type PetNest = {
    moonlings: {
        id: number;
        kind: MoonlingKind;
        name: string | null;
        stage: number;
        stage_name: string;
        active: boolean;
        palette: Palette;
        wear: WearItem[];
        dyes: Dyes;
    }[];
    can_switch: boolean;
    eggs: { kind: MoonlingKind; how: string; earned: boolean }[];
};

type NestMoonling = PetNest['moonlings'][number];

/** Whether "Raise this one" works for a moonling, and why not. The server checks the same. */
export function raiseState(
    nest: PetNest,
    id: number,
): { can: boolean; reason: string | null } {
    if (nest.moonlings.find((m) => m.id === id)?.active) {
        return { can: false, reason: 'You’re raising this one.' };
    }
    if (!nest.can_switch) {
        return {
            can: false,
            reason: 'Your moonling has to hatch first (40 XP) before you raise another.',
        };
    }

    return { can: true, reason: null };
}

/** The nest scene: hatched moonlings rest on the cradle, eggs sit in a pile; the one you're raising first. */
export function nestGroups(moonlings: NestMoonling[]): {
    cradle: NestMoonling[];
    eggs: NestMoonling[];
} {
    const ordered = [...moonlings].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.id - b.id,
    );

    return {
        cradle: ordered.filter((m) => m.stage >= 1),
        eggs: ordered.filter((m) => m.stage === 0),
    };
}

/**
 * The wardrobe's shades (App\Services\Moonlings::PALETTES), open ones first; the server says which are unlocked.
 * Spec 2026-11-26-luna-moonling-style, slice 9: these are the moonling's own art colours, the same in both themes
 * (the user asked to go beyond the theme). This is the one place in the app with art hex values; every other UI
 * stays on the kit's tokens.
 */
export const PALETTES = [
    'classic',
    'dusk',
    'dawn',
    'tide',
    'mist',
    'mint',
    'sakura',
    'ember',
    'frost',
    'cocoa',
    'midnight',
    'gold',
    'nebula',
    'prism',
] as const;

export type Palette = (typeof PALETTES)[number];

/** name, body, mark, face (eyes and mouth), line (the cartoon outline: a deep tone of the body). */
const SHADES: Record<Palette, [string, string, string, string, string]> = {
    classic: ['Classic', '#c4a6ff', '#ff9fd2', '#2b1650', '#3d2373'],
    dusk: ['Dusk', '#6f62d9', '#ffcf5c', '#fff4dc', '#251b63'],
    dawn: ['Dawn', '#ffb48c', '#ff6f86', '#4a1f12', '#8a3a1c'],
    tide: ['Tide', '#4fc6c4', '#ffe08a', '#0b3438', '#0f4d55'],
    mist: ['Mist', '#d8dce8', '#8f9bbd', '#2b3247', '#4b5573'],
    mint: ['Mint', '#92e3b2', '#ff9f80', '#123b28', '#1f5e40'],
    sakura: ['Sakura', '#ffc4de', '#ff6fae', '#5a1636', '#a1386b'],
    ember: ['Ember', '#ff7550', '#ffd15c', '#3b0d04', '#7a1c08'],
    frost: ['Frost', '#bfe6ff', '#5aa9e6', '#0f2f4d', '#2f6a99'],
    cocoa: ['Cocoa', '#a87452', '#f4d3a1', '#2b150a', '#4f2a14'],
    midnight: ['Midnight', '#2e3270', '#9fb4ff', '#eef1ff', '#0e1035'],
    gold: ['Gold', '#ffd457', '#fff2b8', '#4a3200', '#8a5a00'],
    nebula: ['Nebula', '#7b3fb8', '#ff8de1', '#fdf0ff', '#2c0f4f'],
    prism: ['Prism', '#f3f0ff', '#38d6c9', '#2a2350', '#7a5cff'],
};

export const PALETTE_NAMES = Object.fromEntries(
    PALETTES.map((p) => [p, SHADES[p][0]]),
) as Record<Palette, string>;

/** A shade as the sprite's CSS variables: fixed colours, so it looks the same in both themes. */
export function paletteStyle(
    palette: Palette,
): Record<'--pet-body' | '--pet-mark' | '--pet-face' | '--pet-line', string> {
    const [, body, mark, face, line] = SHADES[palette] ?? SHADES.classic;

    return {
        '--pet-body': body,
        '--pet-mark': mark,
        '--pet-face': face,
        '--pet-line': line,
    };
}

/** Where items go (App\Services\Moonlings::SLOTS, spec 2026-11-26-luna-moonling-style, slice 10): one in each. */
export const SLOTS = ['head', 'face', 'neck', 'back', 'hand'] as const;

export type Slot = (typeof SLOTS)[number];

export const SLOT_NAMES: Record<Slot, string> = {
    head: 'Head',
    face: 'Face',
    neck: 'Neck',
    back: 'Back',
    hand: 'Hand',
};

/**
 * The wardrobe's items (App\Services\Moonlings::WEAR), each with its own colour (slice 12): the `default` dye, which
 * the moonling's shade never changes. A new item is one row here and one on the server.
 */
export const WEAR = {
    star_clip: { slot: 'head', label: 'Star clip', color: '#ffcc33' },
    comet_trail: { slot: 'neck', label: 'Comet trail', color: '#5aa9ff' },
    halo: { slot: 'head', label: 'Halo', color: '#ffd84d' },
    scarf: { slot: 'neck', label: 'Scarf', color: '#e8433f' },
    bow: { slot: 'head', label: 'Bow', color: '#ff6fae' },
    propeller: { slot: 'head', label: 'Propeller cap', color: '#3d8bff' },
    glasses: { slot: 'face', label: 'Round glasses', color: '#7a4a2a' },
    wings: { slot: 'back', label: 'Wings', color: '#f4f1ff' },
    cape: { slot: 'back', label: 'Cape', color: '#d6343f' },
    balloon: { slot: 'hand', label: 'Balloon', color: '#ff4d5e' },
    wand: { slot: 'hand', label: 'Wand', color: '#ffd23f' },
    lantern: { slot: 'hand', label: 'Lantern', color: '#c9963b' },
} as const satisfies Record<
    string,
    { slot: Slot; label: string; color: string }
>;

export type WearItem = keyof typeof WEAR;

/** Whether this page knows an item the server sent (an item added on the server first is skipped, not a crash). */
export const knownItem = (key: string): key is WearItem => key in WEAR;

/**
 * Dyes for items (App\Services\Moonlings::DYES): `default` (the item's own colour) and `sun` are open, the rest come
 * from moon quests (App\Services\MoonQuests), the seasonal ones last; the server says which are unlocked.
 */
export const DYES = [
    'default',
    'sun',
    'ruby',
    'leaf',
    'sky',
    'rose',
    'night',
    'starlight',
    'fiesta',
    'parol',
] as const;

export type Dye = (typeof DYES)[number];

export type Dyes = Partial<Record<WearItem, Dye>>;

/** name, colour (fixed art colours; `default` is each item's own). */
const DYE_TABLE: Record<Dye, [string, string | null]> = {
    default: ['Its own', null],
    sun: ['Sun', '#ffc93c'],
    ruby: ['Ruby', '#e0314b'],
    leaf: ['Leaf', '#3fb36b'],
    sky: ['Sky', '#4aa8ff'],
    rose: ['Rose', '#ff7eb6'],
    night: ['Night', '#2b2d5c'],
    starlight: ['Starlight', '#f5f0ff'],
    fiesta: ['Fiesta', '#ff7a1a'],
    parol: ['Parol', '#9b5cff'],
};

export const DYE_NAMES = Object.fromEntries(
    DYES.map((d) => [d, DYE_TABLE[d][0]]),
) as Record<Dye, string>;

/**
 * An item's colour: its dye's, else the item's own (no dye, `default`, or a dye this page doesn't know, such as the
 * `match` stored before slice 12). Never the shade's.
 */
export function dyeColor(dye: Dye | undefined, item: WearItem): string {
    return (dye && DYE_TABLE[dye]?.[1]) || WEAR[item].color;
}

/** A moon quest (App\Services\MoonQuests::list), for the panel's Quests tab. */
export type PetQuest = {
    key: string;
    title: string;
    goal: string;
    progress: number;
    target: number;
    done: boolean;
    dye: Dye;
    seasonal: boolean;
};

/** What unlocks a shade or dye, shown only while it's still locked (null once it's yours, or for an open one). */
export function lockNote(
    swatch: { unlocked: boolean; how: string | null } | undefined,
): string | null {
    return swatch && !swatch.unlocked ? swatch.how : null;
}

/** Puts an item on (swapping out whatever was in its slot), or takes it off when it's already on. */
export function toggleWear(wear: WearItem[], item: WearItem): WearItem[] {
    if (wear.includes(item)) {
        return wear.filter((w) => w !== item);
    }

    return [...wear.filter((w) => WEAR[w].slot !== WEAR[item].slot), item];
}

/** App\Services\Pet::MOOD_LEVELS, best first. */
export type MoodLevel = 'glowing' | 'happy' | 'okay' | 'droopy' | 'gloomy';

/** The office board (App\Services\Pet::board): opted-in people only, no XP. */
export type PetBoardData = {
    joined: boolean;
    rows: {
        rank: number;
        user_id: number;
        first_name: string;
        pet_name: string | null;
        kind: MoonlingKind;
        palette: Palette;
        wear: WearItem[];
        dyes: Dyes;
        stage: number;
        stage_name: string;
        streak: number;
        me: boolean;
        crown: boolean;
    }[];
    /** The Moon Cup (App\Services\PetDuels::cup): this office week's wins, nobody with 0. */
    cup: {
        rank: number;
        user_id: number;
        first_name: string;
        pet_name: string | null;
        kind: MoonlingKind;
        palette: Palette;
        wear: WearItem[];
        dyes: Dyes;
        stage: number;
        stage_name: string;
        wins: number;
        losses: number;
        me: boolean;
        crown: boolean;
    }[];
};

/** "3 wins · 1 loss", or just "1 win" with no losses. */
export function cupRecord(wins: number, losses: number): string {
    const plural = (n: number, one: string, many: string) =>
        `${n} ${n === 1 ? one : many}`;

    return losses > 0
        ? `${plural(wins, 'win', 'wins')} · ${plural(losses, 'loss', 'losses')}`
        : plural(wins, 'win', 'wins');
}

export type PetMoment = 'fed' | 'grew' | null;

/** Moon duels (App\Services\PetDuels): Moon outshines Star, Star outlasts Comet, Comet eclipses Moon. */
export type DuelPick = 'moon' | 'star' | 'comet';

export const DUEL_PICKS: {
    pick: DuelPick;
    label: string;
    icon: string;
    beats: string;
}[] = [
    { pick: 'moon', label: 'Moon', icon: '🌙', beats: 'outshines Star' },
    { pick: 'star', label: 'Star', icon: '⭐', beats: 'outlasts Comet' },
    { pick: 'comet', label: 'Comet', icon: '☄️', beats: 'eclipses Moon' },
];

export type PetDuelsData = {
    /** Never carries the challenger's pick. */
    incoming: {
        id: number;
        from_id: number;
        from: string;
        from_pet: string | null;
        kind: MoonlingKind;
        palette: Palette;
        wear: WearItem[];
        dyes: Dyes;
        stage: number;
        at: string;
    }[];
    sent: {
        id: number;
        to_id: number;
        to: string;
        pick: DuelPick;
        at: string;
    }[];
    results: {
        id: number;
        against: string;
        their_stage: number;
        their_kind: MoonlingKind;
        their_palette: Palette;
        their_wear: WearItem[];
        their_dyes: Dyes;
        mine: DuelPick | null;
        theirs: DuelPick | null;
        outcome: 'win' | 'loss' | 'draw' | 'declined' | 'expired';
        at: string;
    }[];
    tally: { win: number; loss: number; draw: number };
    open_sent_max: number;
};

/**
 * Whether a board row offers "Challenge": you joined, it isn't you, you two have no open duel either way, and you
 * have fewer than the maximum waiting. The server checks the same rules.
 */
export function canChallenge(
    row: PetBoardData['rows'][number],
    duels: PetDuelsData | undefined,
    joined: boolean,
): boolean {
    if (!duels || !joined || row.me) {
        return false;
    }

    const open =
        duels.sent.some((d) => d.to_id === row.user_id) ||
        duels.incoming.some((d) => d.from_id === row.user_id);

    return !open && duels.sent.length < duels.open_sent_max;
}

/** The pet panel's extras (App\Services\Pet::detail), loaded when the panel opens. */
export type PetDetail = {
    xp: Record<'visit' | 'item_time' | 'leave' | 'payslip', number>;
    streak_bonus_max: number;
    /** House XP for an answered duel (only the first of each office day pays). */
    duel_xp: Record<'win' | 'draw' | 'loss', number>;
    /** XP for HR and admin work (slice 11), per area once an office day; null for employees. */
    duty_xp: number | null;
    /** App\Services\Moonlings::wardrobe: every shade, and every item with how to unlock it. */
    wardrobe: {
        /** Every shade; an open one has no `how`. */
        palettes: { key: Palette; unlocked: boolean; how: string | null }[];
        items: {
            key: WearItem;
            slot: Slot;
            /** null: open from the start. */
            how: string | null;
            unlocked: boolean;
        }[];
        dyes: { key: Dye; unlocked: boolean; how: string | null }[];
    };
    week: {
        date: string;
        day: string;
        status: 'visited' | 'missed' | 'skipped' | 'upcoming';
    }[];
    recent: { xp: number; label: string; at: string }[];
};

const STAGES = [0, 40, 150, 400, 900];
const NAMES = ['Egg', 'Hatchling', 'Moonling', 'Bright', 'Full Moon'];

/** Where the pet is: its stage, how full the bar is across that stage, and "95 / 150 XP". */
export function stageProgress(xp: number) {
    const stage = STAGES.filter((at) => xp >= at).length - 1;
    const next = STAGES[stage + 1];

    if (next === undefined) {
        return { stage, name: NAMES[stage], fraction: 1, label: `${xp} XP` };
    }

    return {
        stage,
        name: NAMES[stage],
        fraction: (xp - STAGES[stage]) / (next - STAGES[stage]),
        label: `${xp} / ${next} XP`,
    };
}

/** The five stages for the growth path: reached ones drawn in full, the current one marked, the rest locked. */
export function stagePath(current: number) {
    return NAMES.map((name, stage) => ({
        stage,
        name,
        state:
            stage < current
                ? 'reached'
                : stage === current
                  ? 'current'
                  : 'locked',
    }));
}

/** "Mochi · Full Moon", or just the stage until it has a name. */
export function petTitle(name: string | null, stageName: string): string {
    return name ? `${name} · ${stageName}` : stageName;
}

export function streakLabel(streak: number): string {
    return streak > 1
        ? `🔥 ${streak}-day streak`
        : 'Visit tomorrow to start a streak';
}
