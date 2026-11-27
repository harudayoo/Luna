import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PetSprite } from '../../resources/js/components/pet-sprite';
import { KINDS, nestGroups, raiseState } from '../../resources/js/lib/pet';
import type { MoonlingKind, PetNest } from '../../resources/js/lib/pet';

// pet-nest pulls in the kit (ocs.js) and Inertia's router, which read window, document and history when they load
// (see button.test.tsx).
Object.assign(globalThis, {
    window: globalThis,
    history: {},
    document: { documentElement: {}, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { NestSky } = await import('../../resources/js/components/pet-nest');

const kinds = Object.keys(KINDS) as MoonlingKind[];

const moonling = (
    id: number,
    kind: MoonlingKind,
    stage: number,
    active = false,
) => ({
    id,
    kind,
    name: null,
    stage,
    stage_name: stage === 0 ? 'Egg' : 'Hatchling',
    active,
});

const nest = (moonlings: PetNest['moonlings']): PetNest => ({
    moonlings,
    eggs: [],
});

describe('KINDS', () => {
    it('names the thirteen kinds', () => {
        expect(kinds).toEqual([
            'moon',
            'star',
            'comet',
            'eclipse',
            'aurora',
            'nova',
            'sun',
            'planet',
            'meteor',
            'galaxy',
            'orchid',
            'moonflower',
            'citylight',
        ]);
        for (const k of kinds) {
            expect(KINDS[k].length).toBeGreaterThan(0);
        }
    });
});

describe('raiseState', () => {
    const n = nest([moonling(1, 'moon', 2, true), moonling(2, 'star', 0)]);

    it('lets you raise another, even while raising an egg (spec 2026-11-27-luna-item-icons-switch-eggs)', () => {
        expect(raiseState(n, 2)).toEqual({ can: true, reason: null });
        const eggs = nest([
            moonling(1, 'moon', 0, true),
            moonling(2, 'star', 0),
        ]);
        expect(raiseState(eggs, 2)).toEqual({ can: true, reason: null });
    });

    it('says why not when you are already raising it', () => {
        expect(raiseState(n, 1).can).toBe(false);
        expect(raiseState(n, 1).reason).toMatch(/raising/i);
    });
});

describe('nestGroups', () => {
    it('puts hatched moonlings on the cradle and eggs in the pile, the active one first', () => {
        const g = nestGroups([
            moonling(3, 'comet', 0),
            moonling(1, 'moon', 3, true),
            moonling(2, 'star', 1),
            moonling(4, 'nova', 0),
        ]);
        expect(g.cradle.map((m) => m.id)).toEqual([1, 2]);
        expect(g.eggs.map((m) => m.id)).toEqual([3, 4]);
    });
});

describe('PetSprite kinds', () => {
    const svg = (kind: MoonlingKind, stage: number) =>
        renderToStaticMarkup(
            createElement(PetSprite, { stage, title: 'x', kind }),
        );

    it('draws each kind differently at every stage, in the shade’s colours only', () => {
        for (const stage of [0, 1, 2, 3, 4]) {
            const drawn = kinds.map((k) => svg(k, stage));
            expect(new Set(drawn).size).toBe(kinds.length);
            drawn.forEach((s, i) => {
                expect(s).toContain(`data-pet-kind="${kinds[i]}"`);
                // Only the svg's style (the shade, spec 2026-11-26-luna-moonling-style) and white highlights carry a hex.
                expect(
                    s
                        .replace(/style="--pet-[^"]*"/, '')
                        .replaceAll('#ffffff', ''),
                ).not.toMatch(/#[0-9a-f]{3,8}\b/i);
            });
        }
    });

    it('is a moon when no kind is given', () => {
        expect(
            renderToStaticMarkup(
                createElement(PetSprite, { stage: 2, title: 'x' }),
            ),
        ).toContain('data-pet-kind="moon"');
    });
});

/** Round stars (spec 2026-11-27-luna-jetpack-wings-nest-stars): never stretched by a wide scene. */
describe('NestSky', () => {
    const sky = () => renderToStaticMarkup(createElement(NestSky));

    it('draws no star circle in a stretched svg', () => {
        expect(sky()).not.toMatch(/preserveAspectRatio="none"[^]*<circle/);
    });

    it('places round stars by percent with a fixed pixel size', () => {
        const stars = [
            ...sky().matchAll(/<span[^>]*data-nest-star[^>]*>/g),
        ].map((m) => m[0]);
        expect(stars.length).toBeGreaterThanOrEqual(8);
        for (const s of stars) {
            expect(s).toMatch(/left:\s*[\d.]+%/);
            expect(s).toMatch(/top:\s*[\d.]+%/);
            const w = s.match(/width:\s*([\d.]+)px/)?.[1];
            const h = s.match(/height:\s*([\d.]+)px/)?.[1];
            expect(w).toBeDefined();
            expect(w).toBe(h);
        }
    });
});
