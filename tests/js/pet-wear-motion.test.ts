import { beforeEach, describe, expect, it, vi } from 'vitest';

// Items move (spec 2026-11-26-luna-moonling-style, slice 10): an idle loop for the worn items that have one, a move
// when tapped, and nothing at all under reduced motion. Anime.js is mocked to see what runs on which element.
const calls: { target: unknown; revert: ReturnType<typeof vi.fn> }[] = [];
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

Object.assign(globalThis, {
    window: globalThis,
    document: {
        documentElement: {},
        addEventListener: () => {},
        removeEventListener: () => {},
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { petIdle, petPoke, petWearTap } =
    await import('../../resources/js/lib/ocs');

let reduced = false;
Object.assign(globalThis, {
    OrchidCity: { reduced: () => reduced, isDark: () => false },
});

/** A worn item part: what the sprite marks with data-pet-wear-idle / -tap. */
const part = (idle: string | null, tap: string) =>
    ({
        getAttribute: (name: string) =>
            name === 'data-pet-wear-idle'
                ? idle
                : name === 'data-pet-wear-tap'
                  ? tap
                  : null,
        querySelectorAll: () => [],
    }) as unknown as Element;

const propeller = part('spin', 'spin');
const wand = part(null, 'burst');
const card = {
    querySelector: () => ({}),
    querySelectorAll: (sel: string) =>
        sel === '[data-pet-wear-idle]'
            ? [propeller]
            : sel === '[data-pet-wear-tap]'
              ? [propeller, wand]
              : [],
} as unknown as HTMLElement;

const on = (el: unknown) => calls.filter((c) => c.target === el);

beforeEach(() => {
    calls.length = 0;
    reduced = false;
});

describe('item motion', () => {
    it('loops the idle move of worn items that have one, and stops it on cleanup', () => {
        const stop = petIdle(card);
        expect(on(propeller)).toHaveLength(1);
        expect(on(wand)).toHaveLength(0);
        stop();
        expect(on(propeller)[0].revert).toHaveBeenCalled();
    });

    it('plays each worn item’s move when the moonling is tapped, or one item’s own', () => {
        petPoke(card);
        expect(on(propeller).length).toBeGreaterThan(0);
        expect(on(wand).length).toBeGreaterThan(0);

        calls.length = 0;
        petWearTap(wand);
        expect(on(wand).length).toBeGreaterThan(0);
        expect(on(propeller)).toHaveLength(0);
    });

    it('does nothing under reduced motion', () => {
        reduced = true;
        petIdle(card)();
        petPoke(card);
        petWearTap(wand);
        expect(calls).toHaveLength(0);
    });
});
