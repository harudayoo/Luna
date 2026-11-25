/** The pet on Home (spec 2026-11-24-luna-pet). Stages match App\Services\Pet::STAGES. */
export type Pet = {
    name: string | null;
    public: boolean;
    xp: number;
    stage: number;
    stage_name: string;
    next_at: number | null;
    streak: number;
    fed_today: boolean;
    /** Last week's Moon Cup champion (App\Services\PetDuels::champions). */
    crown: boolean;
};

/** The office board (App\Services\Pet::board): opted-in people only, no XP. */
export type PetBoardData = {
    joined: boolean;
    rows: {
        rank: number;
        user_id: number;
        first_name: string;
        pet_name: string | null;
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
