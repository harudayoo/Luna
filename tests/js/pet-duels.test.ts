import { describe, expect, it } from 'vitest';

import { canChallenge } from '../../resources/js/lib/pet';

const row = (user_id: number, me = false) => ({
    rank: 1,
    user_id,
    first_name: 'X',
    pet_name: null,
    stage: 0,
    stage_name: 'Egg',
    streak: 0,
    me,
});

const duels = (sentTo: number[], incomingFrom: number[] = []) => ({
    incoming: incomingFrom.map((id, i) => ({
        id: 100 + i,
        from_id: id,
        from: 'X',
        from_pet: null,
        stage: 0,
        at: '2026-11-19',
    })),
    sent: sentTo.map((id, i) => ({
        id: i,
        to_id: id,
        to: 'X',
        pick: 'moon' as const,
        at: '2026-11-19',
    })),
    results: [],
    tally: { win: 0, loss: 0, draw: 0 },
    open_sent_max: 3,
});

/** The Challenge button on a board row: the server enforces the same rules. */
describe('canChallenge', () => {
    it('lets someone on the board challenge another person', () => {
        expect(canChallenge(row(2), duels([]), true)).toBe(true);
    });

    it('never offers it on your own row, or when you have not joined', () => {
        expect(canChallenge(row(1, true), duels([]), true)).toBe(false);
        expect(canChallenge(row(2), duels([]), false)).toBe(false);
    });

    it('allows one open duel per pair, in either direction', () => {
        expect(canChallenge(row(2), duels([2]), true)).toBe(false);
        expect(canChallenge(row(2), duels([], [2]), true)).toBe(false);
    });

    it('stops at three open challenges sent', () => {
        expect(canChallenge(row(9), duels([2, 3, 4]), true)).toBe(false);
        expect(canChallenge(row(9), duels([2, 3]), true)).toBe(true);
    });

    it('waits until the duels have loaded', () => {
        expect(canChallenge(row(2), undefined, true)).toBe(false);
    });
});
