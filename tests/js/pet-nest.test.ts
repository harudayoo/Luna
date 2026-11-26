import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PetSprite } from '../../resources/js/components/pet-sprite';
import { KINDS, nestGroups, raiseState } from '../../resources/js/lib/pet';
import type { MoonlingKind, PetNest } from '../../resources/js/lib/pet';

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

const nest = (moonlings: PetNest['moonlings'], can_switch = true): PetNest => ({
    moonlings,
    can_switch,
    eggs: [],
});

describe('KINDS', () => {
    it('names the six kinds', () => {
        expect(kinds).toEqual([
            'moon',
            'star',
            'comet',
            'eclipse',
            'aurora',
            'nova',
        ]);
        for (const k of kinds) {
            expect(KINDS[k].length).toBeGreaterThan(0);
        }
    });
});

describe('raiseState', () => {
    const n = nest([moonling(1, 'moon', 2, true), moonling(2, 'star', 0)]);

    it('lets you raise another once the active one has hatched', () => {
        expect(raiseState(n, 2)).toEqual({ can: true, reason: null });
    });

    it('says why not: already raising it, or still an egg', () => {
        expect(raiseState(n, 1).can).toBe(false);
        expect(raiseState(n, 1).reason).toMatch(/raising/i);
        const egg = raiseState({ ...n, can_switch: false }, 2);
        expect(egg.can).toBe(false);
        expect(egg.reason).toMatch(/hatch/i);
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

    it('draws each kind differently at every stage, in token colours only', () => {
        for (const stage of [0, 1, 2, 3, 4]) {
            const drawn = kinds.map((k) => svg(k, stage));
            expect(new Set(drawn).size).toBe(kinds.length);
            drawn.forEach((s, i) => {
                expect(s).toContain(`data-pet-kind="${kinds[i]}"`);
                expect(s).not.toMatch(/#[0-9a-f]{3,8}\b/i);
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
