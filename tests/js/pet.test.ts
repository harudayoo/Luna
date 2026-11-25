import { describe, expect, it } from 'vitest';

import {
    petTitle,
    stagePath,
    stageProgress,
    streakLabel,
} from '../../resources/js/lib/pet';

describe('stagePath', () => {
    it('marks stages reached, the current one, and the ones still locked', () => {
        expect(stagePath(2).map((s) => s.state)).toEqual([
            'reached',
            'reached',
            'current',
            'locked',
            'locked',
        ]);
        expect(stagePath(0)[0]).toEqual({
            stage: 0,
            name: 'Egg',
            state: 'current',
        });
        expect(
            stagePath(4)
                .map((s) => s.state)
                .at(-1),
        ).toBe('current');
    });
});

describe('petTitle', () => {
    it('puts the name before the stage when the pet has one', () => {
        expect(petTitle('Mochi', 'Full Moon')).toBe('Mochi · Full Moon');
        expect(petTitle(null, 'Egg')).toBe('Egg');
    });
});

describe('stageProgress', () => {
    it('fills the bar across the current stage and labels total over next', () => {
        expect(stageProgress(0)).toEqual({
            stage: 0,
            name: 'Egg',
            fraction: 0,
            label: '0 / 40 XP',
        });
        expect(stageProgress(20).fraction).toBe(0.5);
        expect(stageProgress(95)).toEqual({
            stage: 1,
            name: 'Hatchling',
            fraction: 0.5,
            label: '95 / 150 XP',
        });
        expect(stageProgress(150).stage).toBe(2);
        expect(stageProgress(899).name).toBe('Bright');
    });

    it('caps at the top stage with a full bar', () => {
        expect(stageProgress(900)).toEqual({
            stage: 4,
            name: 'Full Moon',
            fraction: 1,
            label: '900 XP',
        });
        expect(stageProgress(5000).fraction).toBe(1);
    });
});

describe('streakLabel', () => {
    it('invites a streak at one day and counts it after', () => {
        expect(streakLabel(0)).toBe('Visit tomorrow to start a streak');
        expect(streakLabel(1)).toBe('Visit tomorrow to start a streak');
        expect(streakLabel(4)).toBe('🔥 4-day streak');
    });
});
