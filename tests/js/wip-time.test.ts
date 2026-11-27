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
const { wipTime } = await import('../../resources/js/components/item-parts');

/** Time on items reads the way it's logged onto WIP (ItemTime::wip on the server). */
describe('wipTime', () => {
    it('reads hours and minutes', () => {
        expect([155, 45, 120, 0].map(wipTime)).toEqual([
            '2h 35m',
            '45m',
            '2h',
            '0m',
        ]);
    });
});
