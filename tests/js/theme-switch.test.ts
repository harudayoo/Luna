import { describe, expect, it } from 'vitest';

// Same stubs as bloom-dock.test.tsx: the kit and Anime.js read browser globals when they load.
Object.assign(globalThis, {
    window: globalThis,
    document: { documentElement: {}, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { nextTheme, pickEffect, THEME_EFFECTS } =
    await import('../../resources/js/lib/theme-switch');

/*
 * Theme switching (user, 2026-11-19: "sometimes doesn't work", wants more effects at random). Two clicks in
 * one frame used to read the same stale theme and both pick the same one, so the second did nothing.
 */
describe('nextTheme', () => {
    it('flips the current theme', () => {
        expect(nextTheme('light', null)).toBe('dark');
        expect(nextTheme('dark', null)).toBe('light');
    });

    it('flips the theme already on its way, not the stale one', () => {
        expect(nextTheme('light', 'dark')).toBe('light');
        expect(nextTheme('dark', 'light')).toBe('dark');
    });
});

describe('effects', () => {
    const ctx = { x: 300, y: 20, w: 1280, h: 800, r: 1500 };

    it('has at least eight, each with a unique name', () => {
        const names = THEME_EFFECTS.map((e) => e.name);
        expect(names.length).toBeGreaterThanOrEqual(8);
        expect(new Set(names).size).toBe(names.length);
    });

    it('picks at random, never the same twice in a row, and reaches every one', () => {
        let last: string | null = null;
        const seen = new Set<string>();

        for (let i = 0; i < 500; i++) {
            const e = pickEffect(last);
            expect(e.name).not.toBe(last);
            seen.add(e.name);
            last = e.name;
        }

        expect(seen.size).toBe(THEME_EFFECTS.length);
    });

    it('gives keyframes the browser can interpolate', () => {
        for (const e of THEME_EFFECTS) {
            const frames = e.keyframes(ctx);
            expect(frames.length, e.name).toBeGreaterThanOrEqual(2);
            const keys = (f: Keyframe) =>
                Object.keys(f)
                    .filter((k) => k !== 'offset' && k !== 'easing')
                    .sort();
            expect(keys(frames.at(-1)!), e.name).toEqual(keys(frames[0]));

            const points = (f: Keyframe) =>
                String(f.clipPath ?? '').startsWith('polygon')
                    ? String(f.clipPath).split(',').length
                    : null;
            expect(points(frames.at(-1)!), e.name).toBe(points(frames[0]));
        }
    });
});
