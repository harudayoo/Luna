import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    wipLeaveMessage,
    wipMessage,
} from '../../resources/js/lib/wip-message';

/**
 * The message Luna prepares for WIP's Attendance channel after a late is logged: it should read like a person
 * wrote it (a greeting, what happened, the reason, thanks) and vary from one late to the next.
 */
const late = {
    kind: 'late_in' as const,
    date: '2026-11-13',
    start_time: '09:00',
    end_time: '09:47',
    note: '',
};
const TODAY = '2026-11-13';

afterEach(() => vi.restoreAllMocks());

describe('wipMessage', () => {
    it('reads like a person: greeting, what happened, thanks', () => {
        // 0.3 picks the 2nd greeting ("Hi team,"), the 2nd wording and "Thanks!".
        vi.spyOn(Math, 'random').mockReturnValue(0.3);

        expect(wipMessage(late, TODAY)).toBe(
            "Hi team, just a heads up, I'm in late today at 9:47 AM. Thanks!",
        );
    });

    it('starts a new sentence after an exclamation greeting', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);

        expect(wipMessage(late, TODAY)).toBe(
            "Hi Team! I'm running late today, in at 9:47 AM. Thank you!",
        );
    });

    it('varies the wording from one late to the next', () => {
        const seen = new Set(
            Array.from({ length: 40 }, () => wipMessage(late, TODAY)),
        );

        expect(seen.size).toBeGreaterThan(5);
    });

    it('uses the past tense and the day for an earlier date', () => {
        for (let i = 0; i < 20; i++) {
            const m = wipMessage({ ...late, date: '2026-11-12' }, TODAY);

            expect(m).toContain('Nov 12');
            expect(m).not.toContain('today');
            expect(m).toContain('9:47 AM');
        }
    });

    it('gives the note as the reason, without doubling its full stop', () => {
        for (let i = 0; i < 20; i++) {
            const m = wipMessage({ ...late, note: 'Traffic on EDSA.' }, TODAY);

            expect(m).toContain('Traffic on EDSA');
            expect(m).not.toContain('EDSA..');
        }
    });

    it('names the right times for each kind', () => {
        for (let i = 0; i < 20; i++) {
            expect(
                wipMessage(
                    {
                        ...late,
                        kind: 'early_out',
                        start_time: '17:00',
                        end_time: '18:00',
                    },
                    TODAY,
                ),
            ).toContain('5:00 PM');
            const errand = wipMessage(
                {
                    ...late,
                    kind: 'errand',
                    start_time: '14:00',
                    end_time: '14:25',
                },
                TODAY,
            );
            expect(errand).toContain('2:00 PM');
            expect(errand).toContain('2:25 PM');
        }
    });
});

/**
 * The same, after you log your own leave: it should say when you're away (and back), the part of the day,
 * the reason, and never read the same way twice in a row.
 */
describe('wipLeaveMessage', () => {
    // Fri, Nov 20 2026.
    const leave = {
        from: '2026-11-23',
        to: '',
        part: 'full' as const,
        start_time: '13:00',
        end_time: '15:00',
        note: '',
    };
    const DAY = '2026-11-20';
    const many = (l: typeof leave | Record<string, unknown>, n = 30) =>
        Array.from({ length: n }, () =>
            wipLeaveMessage({ ...leave, ...l }, DAY),
        );

    it('reads like a person: greeting, what and when, thanks', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);

        expect(wipLeaveMessage(leave, DAY)).toMatch(
            /^Hi Team! .*on leave.*Nov 23.*Thank you!$/,
        );
    });

    it('varies a lot, and never repeats the text it is asked to avoid', () => {
        expect(new Set(many({}, 60)).size).toBeGreaterThan(40);
        for (let i = 0; i < 30; i++) {
            const first = wipLeaveMessage(leave, DAY);
            expect(wipLeaveMessage(leave, DAY, first)).not.toBe(first);
        }
    });

    it('gives the note as the reason, without doubling its full stop', () => {
        for (const m of many({ note: 'Dentist appointment.' })) {
            expect(m).toContain('Dentist appointment');
            expect(m).not.toContain('appointment..');
        }
    });

    it('says today, tomorrow, or the day, in the right tense', () => {
        for (const m of many({ from: DAY })) {
            expect(m).toMatch(/today|for the day/i);
            expect(m).not.toMatch(/\bwas\b|\btook\b/);
        }
        for (const m of many({ from: '2026-11-23' })) {
            expect(m).not.toMatch(/\btoday\b|tomorrow/);
            expect(m).toContain('Nov 23');
        }
        // From Monday the 23rd, Tuesday is tomorrow.
        for (let i = 0; i < 30; i++) {
            const m = wipLeaveMessage(
                { ...leave, from: '2026-11-24' },
                '2026-11-23',
            );
            expect(m).toMatch(/tomorrow/);
            expect(m).not.toMatch(/\btoday\b/);
        }
        // Thursday the 19th is yesterday: past tense, no promises.
        for (const m of many({ from: '2026-11-19' })) {
            expect(m).toMatch(/was|took|wasn't/);
            expect(m).not.toMatch(/I'll|I'm/);
            expect(m).toMatch(/yesterday|Nov 19/);
        }
        for (const m of many({ from: '2026-11-17' })) {
            expect(m).toContain('Nov 17');
        }
    });

    it('names both ends of a range', () => {
        for (const m of many({ from: '2026-11-23', to: '2026-11-27' })) {
            expect(m).toContain('Nov 23');
            expect(m).toContain('Nov 27');
        }
    });

    it('names the part of the day, or the hours', () => {
        for (const m of many({ part: 'am' })) {
            expect(m).toMatch(/morning|AM/i);
        }
        for (const m of many({ part: 'pm' })) {
            expect(m).toMatch(/afternoon|PM/i);
        }
        for (const m of many({ part: 'hours' })) {
            expect(m).toContain('1:00');
            expect(m).toContain('3:00 PM');
        }
    });

    it('a return day skips the weekend', () => {
        // Leave on Fri the 20th: back on Monday, never Saturday.
        for (const m of many({ from: DAY }, 60)) {
            expect(m).not.toContain('Nov 21');
            expect(m).not.toMatch(/back tomorrow/i);
        }
    });

    it('stays clean in every tense, part and span', () => {
        const froms = [
            '2026-11-17',
            '2026-11-19',
            DAY,
            '2026-11-23',
            '2026-11-24',
        ];
        const tos = ['', '2026-11-27'];
        const parts = ['full', 'am', 'pm', 'hours'] as const;
        for (const from of froms) {
            for (const to of tos) {
                for (const part of parts) {
                    for (const m of many(
                        { from, to, part, note: 'Family errand' },
                        15,
                    )) {
                        expect(m).not.toMatch(
                            / {2}| ,| \.|\.\.|undefined|NaN|\(\)/,
                        );
                        expect(m).toMatch(/[!.]$/);
                    }
                }
            }
        }
    });
});
