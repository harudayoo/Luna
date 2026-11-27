import { describe, expect, it, vi } from 'vitest';

// Anime.js is mocked so the test can see which personality the idle motion runs.
const running: {
    target: unknown;
    y: number;
    scaleY: unknown;
    revert: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock('animejs', () => ({
    animate: vi.fn((target: unknown, params: { y?: number; scaleY?: unknown }) => {
        const animation = {
            target,
            y: params.y ?? 0,
            scaleY: params.scaleY,
            revert: vi.fn(),
        };
        running.push(animation);

        return animation;
    }),
    spring: () => 'spring',
    stagger: () => 0,
    utils: { set: () => {} },
}));

// The kit reads browser globals when it loads; listeners are kept so the test can fire "ocs:theme".
const listeners = new Map<string, Set<() => void>>();
Object.assign(globalThis, {
    window: globalThis,
    document: {
        documentElement: {},
        addEventListener: (type: string, fn: () => void) => {
            if (!listeners.has(type)) {
                listeners.set(type, new Set());
            }
            listeners.get(type)!.add(fn);
        },
        removeEventListener: (type: string, fn: () => void) =>
            listeners.get(type)?.delete(fn),
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { petIdle } = await import('../../resources/js/lib/ocs');

let dark = false;
Object.assign(globalThis, {
    OrchidCity: { reduced: () => false, isDark: () => dark },
});

const parts: Record<string, object> = {
    '[data-pet-body]': { part: 'body' },
    '[data-pet-breath]': { part: 'breath' },
};
const card = {
    querySelector: (sel: string) => parts[sel] ?? null,
    querySelectorAll: () => [],
    getAttribute: () => null,
} as unknown as HTMLElement;
const bobs = () => running.filter((a) => a.y !== 0);
const breaths = () =>
    running.filter((a) => a.target === parts['[data-pet-breath]']);

/** The pet's idle bob follows the theme while the page stays open (no reload needed). */
describe('petIdle', () => {
    it('breathes in the light theme with no bob, adds the dark float when the theme turns dark, and stops on cleanup', () => {
        const stop = petIdle(card);
        expect(bobs()).toEqual([]);
        expect(breaths()).toHaveLength(1);
        expect(breaths()[0].scaleY).toBeDefined();

        dark = true;
        listeners.get('ocs:theme')?.forEach((fn) => fn());

        expect(breaths()[0].revert).toHaveBeenCalled();
        expect(breaths()).toHaveLength(2);
        expect(bobs().map((a) => a.y)).toEqual([-4]);

        stop();
        expect(breaths()[1].revert).toHaveBeenCalled();
        expect(bobs()[0].revert).toHaveBeenCalled();
        expect(listeners.get('ocs:theme')?.size ?? 0).toBe(0);
    });
});
