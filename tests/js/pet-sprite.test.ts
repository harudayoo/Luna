import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
    outlinePath,
    PetSprite,
} from '../../resources/js/components/pet-sprite';
import type { MoodLevel } from '../../resources/js/lib/pet';

const svg = (stage: number, mood?: MoodLevel) =>
    renderToStaticMarkup(createElement(PetSprite, { stage, title: 'x', mood }));

/** The redesign (spec 2026-11-26-luna-moonling-redesign): the parts the motion moves, and the new face. */
describe('PetSprite redesign', () => {
    it('has the layers the motion moves, from the egg on', () => {
        for (const stage of [0, 1, 2, 3, 4]) {
            const s = svg(stage);
            for (const hook of [
                'data-pet-shadow',
                'data-pet-lean',
                'data-pet-body',
                'data-pet-hop',
                'data-pet-breath',
                'data-pet-fx',
                'data-pet-outline',
            ]) {
                expect(s, `${hook} at stage ${stage}`).toContain(hook);
            }
        }
    });

    it('draws a soft body path rather than a circle once hatched', () => {
        for (const stage of [1, 2, 3, 4]) {
            expect(svg(stage)).toMatch(/<path[^>]*data-pet-outline/);
        }
    });

    it('has arms to wave from the Moonling on', () => {
        expect(svg(1)).not.toContain('data-pet-arm');
        expect(svg(2)).toContain('data-pet-arm="left"');
        expect(svg(2)).toContain('data-pet-arm="right"');
    });

    it('blushes from the Moonling on', () => {
        expect(svg(1)).not.toContain('data-pet-blush');
        expect(svg(2)).toContain('data-pet-blush');
    });

    it('closes its eyes when droopy or gloomy, and says its mood on the svg', () => {
        for (const mood of ['droopy', 'gloomy'] as const) {
            const s = svg(3, mood);
            expect(s).toContain('data-pet-eyes-closed');
            expect(s).toContain(`data-pet-mood="${mood}"`);
        }
        expect(svg(3, 'happy')).not.toContain('data-pet-eyes-closed');
    });

    it('carries the happy and surprised faces, ready for the motion to show', () => {
        const s = svg(3, 'okay');
        expect(s).toContain('data-pet-eyes-happy');
        expect(s).toContain('data-pet-mouth-o');
        expect(s).toContain('data-pet-mouth=""');
    });
});

/** Rocket wings (spec 2026-11-27-luna-jetpack-wings-nest-stars): the jetpack shows past the body's sides. */
describe('PetSprite jetpack', () => {
    const xs = (d: string) =>
        [...d.matchAll(/[MLQC]\s*([-\d.]+)[ ,]([-\d.]+)/g)].map((m) =>
            Number(m[1]),
        );

    it('has two rocket wings that reach past the body edge at every hatched stage', () => {
        for (const stage of [1, 2, 3, 4]) {
            const body = xs(outlinePath(stage));
            const right = Math.max(...body);
            const left = Math.min(...body);
            const s = renderToStaticMarkup(
                createElement(PetSprite, {
                    stage,
                    title: 'x',
                    wear: ['jetpack'],
                }),
            );
            const wings = [
                ...s.matchAll(
                    /<path[^>]*data-pet-jetpack-wing="(left|right)"[^>]*>/g,
                ),
            ];
            expect(wings.map((w) => w[1]).sort(), `stage ${stage}`).toEqual([
                'left',
                'right',
            ]);
            for (const [tag, side] of wings) {
                const d = tag.match(/ d="([^"]+)"/)![1];
                if (side === 'right') {
                    expect(
                        Math.max(...xs(d)),
                        `stage ${stage}`,
                    ).toBeGreaterThan(right + 4);
                } else {
                    expect(Math.min(...xs(d)), `stage ${stage}`).toBeLessThan(
                        left - 4,
                    );
                }
            }
        }
    });
});
