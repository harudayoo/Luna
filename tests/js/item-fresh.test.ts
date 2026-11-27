import { describe, expect, it } from 'vitest';

// Same stubs as bloom-dock.test.tsx: the kit and Anime.js read browser globals when they load.
Object.assign(globalThis, {
    window: globalThis,
    document: { documentElement: {}, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    history: { scrollRestoration: 'auto', state: null, replaceState: () => {} },
    location: { href: 'http://localhost/', pathname: '/' },
});
const { flushesPrefetch } =
    await import('../../resources/js/components/item-parts');

/*
 * Item pages are prefetched on hover and Inertia keeps them 30 s; after a change it only drops the current
 * page. So starting the clock on the list, then opening the item, showed the old page: no clock, Start
 * still there (user, 2026-11-19). Any change must drop every prefetched page.
 */
describe('flushesPrefetch', () => {
    it('drops prefetched pages after a change', () => {
        expect(
            ['post', 'put', 'patch', 'delete'].map((method) =>
                flushesPrefetch({ method }),
            ),
        ).toEqual([true, true, true, true]);
    });

    it('keeps them for a plain visit', () => {
        expect(flushesPrefetch({ method: 'get' })).toBe(false);
    });
});
