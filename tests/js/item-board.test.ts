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
const { boardColumns } =
    await import('../../resources/js/components/item-parts');

const item = (id: number, status: string) => ({ id, status }) as never;

/** The item board: one column per status, in legend order; a status filter leaves just its column. */
describe('boardColumns', () => {
    const items = [
        item(1, 'done'),
        item(2, 'queue'),
        item(3, 'progress'),
        item(4, 'queue'),
    ];

    it('makes a column per status in legend order, empty ones included', () => {
        const cols = boardColumns(items, null);
        expect(cols.map((c) => c.status.key)).toEqual([
            'queue',
            'progress',
            'hold',
            'done',
        ]);
        expect(
            cols.map((c) => c.items.map((i: { id: number }) => i.id)),
        ).toEqual([[2, 4], [3], [], [1]]);
    });

    it('keeps only the filtered status column', () => {
        const cols = boardColumns(items, 'queue');
        expect(cols).toHaveLength(1);
        expect(cols[0].items).toHaveLength(2);
    });
});
