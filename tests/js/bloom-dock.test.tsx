import { describe, expect, it } from 'vitest';

// Same stubs as button.test.tsx: the kit and Anime.js read browser globals when they load.
Object.assign(globalThis, {
    window: globalThis,
    document: { documentElement: {}, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    // Inertia's router reads history and location when it loads.
    history: { scrollRestoration: 'auto', state: null, replaceState: () => {} },
    location: { href: 'http://localhost/', pathname: '/' },
});
const { arc, splitDock } =
    await import('../../resources/js/components/bloom-dock');

/**
 * The Bloom dock: five slots. HR and admin have more modules than that, so the middle slot becomes an
 * orchid bud and the rest bloom out of it in an arc above the dock.
 */
describe('splitDock', () => {
    it('keeps five or fewer modules in one row, with no bud', () => {
        expect(splitDock([1, 2, 3, 4, 5])).toEqual({
            left: [1, 2, 3, 4, 5],
            fanned: [],
            right: [],
        });
    });

    it('puts the bud in the middle slot and fans out the rest in order', () => {
        // Home, Time | bud | Leave, Calendar; Analytics and People fan out.
        expect(splitDock(['h', 't', 'l', 'c', 'a', 'p'])).toEqual({
            left: ['h', 't'],
            fanned: ['a', 'p'],
            right: ['l', 'c'],
        });
    });
});

describe('arc', () => {
    const dockTop = -32; // the bud's centre sits mid-dock; the dock is 64px tall
    const tile = 64;

    it.each([1, 2, 3, 4, 5, 6, 8])(
        'lays %i tiles above the dock without overlap, inside 360 wide',
        (n) => {
            const spots = arc(n);
            expect(spots).toHaveLength(n);

            spots.forEach((s, i) => {
                // the tile's bottom edge clears the top of the dock
                expect(s.y + tile / 2).toBeLessThanOrEqual(dockTop);
                // a 360px phone has 180px either side of the centred bud, less the page's 12px padding
                expect(Math.abs(s.x) + tile / 2).toBeLessThanOrEqual(168);

                spots.slice(0, i).forEach((p) => {
                    // 64px squares never touch: 4px+ of air on at least one axis
                    expect(
                        Math.max(Math.abs(s.x - p.x), Math.abs(s.y - p.y)),
                    ).toBeGreaterThanOrEqual(tile + 4);
                });
            });
        },
    );

    it('is symmetric around the bud', () => {
        const spots = arc(4);
        expect(spots[0].x).toBe(-spots[3].x);
        expect(spots[0].y).toBe(spots[3].y);
    });
});
