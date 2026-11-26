import { describe, expect, it } from 'vitest';

import { KINDS } from '../../resources/js/lib/pet';
import type { MoonlingKind } from '../../resources/js/lib/pet';
import {
    homeCue,
    KIND_LINES,
    MOODS,
    shouldSpeak,
    TRIGGERS,
    VOICE,
    voiceLine,
} from '../../resources/js/lib/pet-voice';

const levels = MOODS.map((m) => m.level);

describe('MOODS', () => {
    it('has the five levels, each with a name and a way to cheer it up', () => {
        expect(levels).toEqual([
            'glowing',
            'happy',
            'okay',
            'droopy',
            'gloomy',
        ]);
        for (const m of MOODS) {
            expect(m.label.length).toBeGreaterThan(0);
            expect(m.hint.length).toBeGreaterThan(0);
        }
    });
});

describe('voiceLine', () => {
    it('has a line for every trigger at every mood', () => {
        for (const trigger of TRIGGERS) {
            for (const level of levels) {
                expect(voiceLine(trigger, level, () => 0)).toMatch(/\S/);
                expect(voiceLine(trigger, level, () => 0.999)).toMatch(/\S/);
            }
        }
    });

    it('picks from the table with the random number given', () => {
        const taps = VOICE.tap.happy;
        expect(voiceLine('tap', 'happy', () => 0)).toBe(taps[0]);
        expect(voiceLine('tap', 'happy', () => 0.999)).toBe(taps.at(-1));
    });

    it('never talks about lates, and never guilt-trips', () => {
        const all = JSON.stringify(VOICE);
        expect(all).not.toMatch(/\blate|tard|punctual|on time/i);
        expect(all).not.toMatch(/abandon|forgot me|ignored|disappoint/i);
    });
});

describe('homeCue', () => {
    const pet = (over: Partial<Parameters<typeof homeCue>[0]> = {}) => ({
        days_away: 0,
        today: { time_logged: false, leave_filed: false, duel_waiting: false },
        ...over,
    });

    it('says nothing when nothing happened', () => {
        expect(homeCue(pet(), null)).toBeNull();
    });

    it('puts growing first, then coming back, then news, then being fed', () => {
        const busy = pet({
            days_away: 3,
            today: { time_logged: true, leave_filed: true, duel_waiting: true },
        });
        expect(homeCue(busy, 'grew')).toBe('grew');
        expect(homeCue(busy, 'fed')).toBe('away');
        expect(homeCue({ ...busy, days_away: 1 }, 'fed')).toBe('duel');
        expect(
            homeCue(
                pet({
                    today: {
                        time_logged: true,
                        leave_filed: true,
                        duel_waiting: false,
                    },
                }),
                null,
            ),
        ).toBe('leave');
        expect(
            homeCue(
                pet({
                    today: {
                        time_logged: true,
                        leave_filed: false,
                        duel_waiting: false,
                    },
                }),
                null,
            ),
        ).toBe('time');
        expect(homeCue(pet(), 'fed')).toBe('fed');
    });
});

// Slice 8 (spec 2026-11-25-luna-moonling-life): more lines, new moments, no repeats, "now and then" on Home.
describe('more voice lines', () => {
    it('has the new moments', () => {
        expect(TRIGGERS).toEqual([
            'tap',
            'fed',
            'grew',
            'time',
            'leave',
            'duel',
            'away',
            'morning',
            'afternoon',
            'evening',
            'monday',
            'friday',
            'payday',
            'eve',
            'crown',
            'combo',
            'outfit',
        ]);
    });

    it('has at least 8 lines for every moment and every tap mood, and 3 for every kind', () => {
        for (const trigger of TRIGGERS) {
            if (trigger === 'tap') {
                for (const level of levels) {
                    expect(VOICE.tap[level].length).toBeGreaterThanOrEqual(8);
                }
            } else {
                expect(VOICE[trigger].length).toBeGreaterThanOrEqual(8);
            }
        }
        for (const kind of Object.keys(KINDS) as MoonlingKind[]) {
            expect(KIND_LINES[kind].length).toBeGreaterThanOrEqual(3);
        }
    });

    it('never says the same line twice in a row', () => {
        for (const trigger of TRIGGERS) {
            for (const level of levels) {
                const first = voiceLine(trigger, level, () => 0);
                expect(voiceLine(trigger, level, () => 0, first)).not.toBe(
                    first,
                );
            }
        }
    });

    it('mixes the kind’s own lines into taps', () => {
        const said = new Set(
            Array.from({ length: 40 }, (_, i) =>
                voiceLine('tap', 'happy', () => i / 40, undefined, 'comet'),
            ),
        );
        expect(KIND_LINES.comet.some((l) => said.has(l))).toBe(true);
        expect(KIND_LINES.star.some((l) => said.has(l))).toBe(false);
    });

    it('still never talks about lates or guilt, in any new line', () => {
        const all = JSON.stringify([VOICE, KIND_LINES]);
        expect(all).not.toMatch(/\blate|tard|punctual|on time/i);
        expect(all).not.toMatch(/abandon|forgot me|ignored|disappoint/i);
    });
});

describe('homeCue with the new moments', () => {
    const pet = (today: Record<string, unknown> = {}, crown = false) => ({
        days_away: 0,
        crown,
        today: {
            time_logged: false,
            leave_filed: false,
            duel_waiting: false,
            payday: false,
            day_off_tomorrow: false,
            weekday: 3,
            part: 'afternoon' as const,
            ...today,
        },
    });

    it('puts payday and the eve of a day off before the rest of today’s news', () => {
        expect(homeCue(pet({ payday: true, leave_filed: true }), null)).toBe(
            'payday',
        );
        expect(
            homeCue(pet({ day_off_tomorrow: true, time_logged: true }), null),
        ).toBe('eve');
        expect(homeCue(pet({ duel_waiting: true, payday: true }), null)).toBe(
            'duel',
        );
    });

    it('then the crown week, then Monday or Friday, then being fed, then the time of day', () => {
        expect(homeCue(pet({ weekday: 1 }, true), 'fed')).toBe('crown');
        expect(homeCue(pet({ weekday: 1 }), 'fed')).toBe('monday');
        expect(homeCue(pet({ weekday: 5 }), null)).toBe('friday');
        expect(homeCue(pet(), 'fed')).toBe('fed');
        expect(homeCue(pet({ part: 'morning' }), null)).toBe('morning');
        expect(homeCue(pet({ part: 'evening' }), null)).toBe('evening');
    });
});

describe('shouldSpeak (now and then)', () => {
    it('speaks once per part of the office day, but always when it grew', () => {
        expect(shouldSpeak('morning', '2026-11-19:morning', null)).toBe(true);
        expect(
            shouldSpeak('fed', '2026-11-19:morning', '2026-11-19:morning'),
        ).toBe(false);
        expect(
            shouldSpeak('afternoon', '2026-11-19:afternoon', '2026-11-19:morning'),
        ).toBe(true);
        expect(
            shouldSpeak('grew', '2026-11-19:morning', '2026-11-19:morning'),
        ).toBe(true);
        expect(shouldSpeak(null, '2026-11-19:morning', null)).toBe(false);
    });
});
