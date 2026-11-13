import { afterEach, describe, expect, it, vi } from 'vitest';
import { wipMessage } from '../../resources/js/lib/wip-message';

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
