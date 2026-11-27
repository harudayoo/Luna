import { beforeEach, describe, expect, it, vi } from 'vitest';

// Tapping an item plays it (spec 2026-11-27-luna-item-fit-play-bubble): its own move, a puff of its kind, and a hop for
// the items that lift. Anime.js and the DOM are mocked to see what runs where.
const calls: { target: unknown }[] = [];
vi.mock('animejs', () => ({
    animate: vi.fn((target: unknown) => {
        const animation = { target, revert: vi.fn() };
        calls.push(animation);

        return animation;
    }),
    spring: () => 'spring',
    stagger: () => 0,
    utils: { set: () => {} },
}));

const node = () => ({
    setAttribute: () => {},
    appendChild: () => {},
    remove: () => {},
    style: {},
});
Object.assign(globalThis, {
    window: globalThis,
    document: {
        documentElement: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        createElementNS: node,
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { petItemTap, petPoke } = await import('../../resources/js/lib/ocs');
const { WEAR } = await import('../../resources/js/lib/pet');

let reduced = false;
Object.assign(globalThis, {
    OrchidCity: { reduced: () => reduced, isDark: () => false },
});

const wand = {
    getAttribute: (name: string) =>
        name === 'data-pet-wear-tap' ? 'burst' : null,
    hasAttribute: (name: string) => name === 'data-pet-wear-tap',
    querySelectorAll: () => [],
    getBBox: () => ({ x: 90, y: 40, width: 10, height: 20 }),
} as unknown as Element;

const puffs: unknown[] = [];
const fx = { appendChild: (c: unknown) => puffs.push(c) };
const hop = {};
const sprite = {
    querySelector: (sel: string) =>
        sel === '[data-pet-fx]' ? fx : sel === '[data-pet-hop]' ? hop : null,
    querySelectorAll: () => [],
} as unknown as HTMLElement;

beforeEach(() => {
    calls.length = 0;
    puffs.length = 0;
    reduced = false;
});

describe('item play', () => {
    it('gives every item something to set off when tapped', () => {
        for (const [item, row] of Object.entries(WEAR)) {
            expect(['star', 'heart', 'note'], item).toContain(
                (row as { fx?: string }).fx,
            );
        }
    });

    it('plays the item, puffs from where it is, and hops for the items that lift', () => {
        petItemTap(sprite, wand, 'wand');
        expect(calls.some((c) => c.target === wand)).toBe(true);
        expect(puffs.length).toBeGreaterThanOrEqual(2);
        expect(calls.some((c) => c.target === hop)).toBe(false);

        calls.length = 0;
        petItemTap(sprite, wand, 'propeller');
        expect(calls.some((c) => c.target === hop)).toBe(true);
    });

    it('does nothing under reduced motion', () => {
        reduced = true;
        petItemTap(sprite, wand, 'wand');
        expect(calls).toHaveLength(0);
        expect(puffs).toHaveLength(0);
    });
});

// The line waits for a hop to land, so the moonling never jumps into its own bubble.
describe('when it speaks', () => {
    it('says how long until a hop lands, or 0 when there is none', () => {
        expect(petItemTap(sprite, wand, 'wand')).toBe(0);
        expect(petItemTap(sprite, wand, 'propeller')).toBeGreaterThan(400);
        expect(petPoke(sprite)).toBeGreaterThan(400);
    });

    it('speaks at once under reduced motion', () => {
        reduced = true;
        expect(petPoke(sprite)).toBe(0);
        expect(petItemTap(sprite, wand, 'propeller')).toBe(0);
    });
});
