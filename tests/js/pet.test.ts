import { describe, expect, it } from 'vitest';

import { stageProgress, streakLabel } from '../../resources/js/lib/pet';

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
