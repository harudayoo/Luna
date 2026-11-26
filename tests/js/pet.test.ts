import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PetSprite } from '../../resources/js/components/pet-sprite';
import {
    cupRecord,
    petTitle,
    stagePath,
    stageProgress,
    streakLabel,
} from '../../resources/js/lib/pet';

describe('cupRecord', () => {
    it('counts wins, and losses only when there are some', () => {
        expect(cupRecord(1, 0)).toBe('1 win');
        expect(cupRecord(3, 1)).toBe('3 wins · 1 loss');
        expect(cupRecord(2, 2)).toBe('2 wins · 2 losses');
    });
});

describe('PetSprite crown', () => {
    const sprite = (stage: number, crown?: boolean) =>
        renderToStaticMarkup(
            createElement(PetSprite, { stage, title: 'x', crown }),
        );

    it('draws the Moon Cup crown at every stage, the egg included, in the shade’s colours', () => {
        for (const stage of [0, 1, 2, 3, 4]) {
            const svg = sprite(stage, true);
            expect(svg).toContain('data-pet-crown');
            // Only the svg's style (the shade, spec 2026-11-26-luna-moonling-style) and white highlights carry a hex.
            expect(
                svg
                    .replace(/style="--pet-[^"]*"/, '')
                    .replaceAll('#ffffff', ''),
            ).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        }
    });

    it('draws no crown unless asked', () => {
        expect(sprite(2)).not.toContain('data-pet-crown');
        expect(sprite(2, false)).not.toContain('data-pet-crown');
    });
});

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
