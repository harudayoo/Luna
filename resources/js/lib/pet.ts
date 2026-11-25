/** The pet on Home (spec 2026-11-24-luna-pet). Stages match App\Services\Pet::STAGES. */
export type Pet = {
    name: string | null;
    xp: number;
    stage: number;
    stage_name: string;
    next_at: number | null;
    streak: number;
    fed_today: boolean;
};

export type PetMoment = 'fed' | 'grew' | null;

/** The pet panel's extras (App\Services\Pet::detail), loaded when the panel opens. */
export type PetDetail = {
    xp: Record<'visit' | 'item_time' | 'leave' | 'payslip', number>;
    streak_bonus_max: number;
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
