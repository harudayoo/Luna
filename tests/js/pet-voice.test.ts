import { describe, expect, it } from 'vitest';

import {
    homeCue,
    MOODS,
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
