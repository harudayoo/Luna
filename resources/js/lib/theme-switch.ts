/*
 * Luna's light/dark switch (user, 2026-11-19): it must always switch, and each switch plays one of several
 * effects at random. Replaces the kit's two-effect themeToggle (resources/ocs/ocs.js, left untouched); the
 * theme itself is still the kit's (OrchidCity.setTheme: data-theme, localStorage, "ocs:theme").
 *
 * Why the old one "sometimes didn't work":
 *   - the next theme was read from <html data-theme> on click, but a view transition applies it a frame later,
 *     so two quick clicks both chose the same theme and the second did nothing (nextTheme fixes this);
 *   - a skipped transition (another one started, the phone's URL bar resized the viewport, the tab was hidden)
 *     rejected `ready` and no effect ran (switchTheme falls back to an overlay sheet).
 * Reduced motion: the theme switches instantly, as the kit requires.
 */
import { animate } from 'animejs';
import { ocs } from '@/lib/ocs';

export type Theme = 'light' | 'dark';

/** Where the switch starts (the tap) and the viewport; r reaches the farthest corner from the tap. */
export type SwitchCtx = {
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
};

export type ThemeEffect = {
    name: string;
    /** "new" reveals the new theme over the old; "old" sends the old view away to uncover the new one. */
    target: 'new' | 'old';
    keyframes: (c: SwitchCtx) => Keyframe[];
    duration: number;
    easing: string;
};

/** The theme to switch to: from the one already on its way, if a switch is still in flight. */
export function nextTheme(current: Theme, pending: Theme | null): Theme {
    return (pending ?? current) === 'dark' ? 'light' : 'dark';
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const poly = (pts: [number, number][]) =>
    `polygon(${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(', ')})`;

/** A five-petal orchid (a ten-point star) of radius s around the tap. */
const bloom = (c: SwitchCtx, s: number) =>
    poly(
        Array.from({ length: 10 }, (_, i) => {
            const a = ((-90 + i * 36) * Math.PI) / 180;
            const rr = i % 2 === 0 ? s : s * 0.5;

            return [c.x + rr * Math.cos(a), c.y + rr * Math.sin(a)];
        }),
    );

/** Eight horizontal slats, each open by `t` (0-1) around its middle. Disjoint, but one polygon. */
const blinds = (c: SwitchCtx, t: number) => {
    const n = 8;
    const band = c.h / n;
    const pts: [number, number][] = [];

    for (let i = 0; i < n; i++) {
        const mid = band * i + band / 2;
        const half = (band / 2) * t;
        pts.push(
            [0, mid - half],
            [c.w, mid - half],
            [c.w, mid + half],
            [0, mid + half],
        );
    }

    return poly(pts);
};

export const THEME_EFFECTS: ThemeEffect[] = [
    {
        name: 'spread',
        target: 'new',
        keyframes: (c) => [
            { clipPath: `circle(0px at ${px(c.x)} ${px(c.y)})` },
            { clipPath: `circle(${px(c.r)} at ${px(c.x)} ${px(c.y)})` },
        ],
        duration: 600,
        easing: 'cubic-bezier(.65,0,.35,1)',
    },
    {
        name: 'sheet',
        target: 'new',
        keyframes: () => [
            { clipPath: 'inset(0 100% 0 0)' },
            { clipPath: 'inset(0 0% 0 0)' },
        ],
        duration: 560,
        easing: 'cubic-bezier(.2,.8,.2,1)',
    },
    {
        name: 'bloom',
        target: 'new',
        keyframes: (c) => [
            { clipPath: bloom(c, 0) },
            { clipPath: bloom(c, c.r * 2.3) },
        ],
        duration: 750,
        easing: 'cubic-bezier(.5,0,.2,1)',
    },
    {
        name: 'diamond',
        target: 'new',
        keyframes: (c) => {
            const d = (s: number) =>
                poly([
                    [c.x, c.y - s],
                    [c.x + s, c.y],
                    [c.x, c.y + s],
                    [c.x - s, c.y],
                ]);

            return [{ clipPath: d(0) }, { clipPath: d(c.w + c.h) }];
        },
        duration: 620,
        easing: 'cubic-bezier(.7,0,.3,1)',
    },
    {
        name: 'doors',
        target: 'new',
        keyframes: () => [
            { clipPath: 'inset(0 50% 0 50%)' },
            { clipPath: 'inset(0 0% 0 0%)' },
        ],
        duration: 600,
        easing: 'cubic-bezier(.3,1.3,.5,1)',
    },
    {
        name: 'blinds',
        target: 'new',
        keyframes: (c) => [
            { clipPath: blinds(c, 0) },
            { clipPath: blinds(c, 1) },
        ],
        duration: 650,
        easing: 'cubic-bezier(.6,0,.3,1)',
    },
    {
        name: 'eye',
        target: 'new',
        keyframes: (c) => [
            { clipPath: `ellipse(${px(c.w)} 0px at 50% 50%)`, offset: 0 },
            {
                clipPath: `ellipse(${px(c.w)} ${px(c.h * 0.08)} at 50% 50%)`,
                offset: 0.35,
            },
            {
                clipPath: `ellipse(${px(c.w)} ${px(c.h * 1.2)} at 50% 50%)`,
                offset: 1,
            },
        ],
        duration: 720,
        easing: 'cubic-bezier(.5,0,.3,1)',
    },
    {
        name: 'fall',
        target: 'old',
        keyframes: (c) => {
            const tilt = c.x < c.w / 2 ? 9 : -9;

            return [
                {
                    transform: 'translateY(0) rotate(0deg)',
                    transformOrigin: `${px(c.x)} 0px`,
                },
                {
                    transform: `translateY(${px(c.h * 1.15)}) rotate(${tilt}deg)`,
                    transformOrigin: `${px(c.x)} 0px`,
                },
            ];
        },
        duration: 700,
        easing: 'cubic-bezier(.55,0,.8,.3)',
    },
    {
        name: 'vortex',
        target: 'old',
        keyframes: (c) => [
            {
                transform: 'scale(1) rotate(0deg)',
                opacity: 1,
                transformOrigin: `${px(c.x)} ${px(c.y)}`,
            },
            {
                transform: 'scale(0) rotate(240deg)',
                opacity: 0.4,
                transformOrigin: `${px(c.x)} ${px(c.y)}`,
            },
        ],
        duration: 700,
        easing: 'cubic-bezier(.6,0,.4,1)',
    },
    {
        name: 'flip',
        target: 'old',
        keyframes: () => [
            {
                transform: 'perspective(1400px) rotateX(0deg)',
                opacity: 1,
                transformOrigin: '50% 0%',
            },
            {
                transform: 'perspective(1400px) rotateX(-95deg)',
                opacity: 0.6,
                transformOrigin: '50% 0%',
            },
        ],
        duration: 650,
        easing: 'cubic-bezier(.5,0,.75,0)',
    },
];

/** A random effect, never the one just played. */
export function pickEffect(last: string | null): ThemeEffect {
    const pool = THEME_EFFECTS.filter((e) => e.name !== last);

    return pool[Math.floor(Math.random() * pool.length)];
}

type VT = {
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    finished: Promise<void>;
    skipTransition: () => void;
};

let pending: Theme | null = null;
let running: VT | null = null;
let last: string | null = null;

const current = (): Theme =>
    document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';

/** The kit's icon flourish: the sun turns into the moon going dark, the moon bounces going light. */
function spinIcon(icon: Element | null, next: Theme) {
    if (!icon) {
        return;
    }

    if (next === 'dark') {
        animate(icon, {
            rotate: '+=360',
            scale: [
                { to: 0.6, duration: 160 },
                { to: 1, duration: 420, ease: 'outBack' },
            ],
            duration: 580,
            ease: 'outQuart',
        });
    } else {
        animate(icon, {
            y: [
                { to: 10, duration: 160, ease: 'inQuad' },
                { to: 0, duration: 420, ease: 'outBounce' },
            ],
        });
    }
}

/**
 * No view transition to animate (missing, or the browser skipped it): a sheet in the old background colour
 * plays an "old" effect over the page, which already has the new theme.
 */
function overlay(c: SwitchCtx, oldBg: string, effect: ThemeEffect) {
    const fx =
        effect.target === 'old'
            ? effect
            : THEME_EFFECTS.find((e) => e.name === 'fall')!;
    const sheet = document.createElement('div');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.cssText = `position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:${oldBg}`;
    document.body.append(sheet);
    void sheet
        .animate(fx.keyframes(c), {
            duration: fx.duration,
            easing: fx.easing,
            fill: 'forwards',
        })
        .finished.finally(() => sheet.remove());
}

/**
 * Switch light <-> dark from a tap at (x, y). Always switches: a running switch is cut short first, the theme
 * is applied whether or not the transition runs, and the effect falls back to an overlay sheet.
 */
export function switchTheme(
    origin: { x: number; y: number },
    icon: Element | null = null,
): void {
    const root = document.documentElement;
    const next = nextTheme(current(), pending);
    const apply = () => {
        if (current() !== next) {
            ocs().setTheme(next);
        }
    };

    running?.skipTransition();
    running = null;
    pending = next;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const c: SwitchCtx = {
        x: origin.x,
        y: origin.y,
        w,
        h,
        r: Math.hypot(
            Math.max(origin.x, w - origin.x),
            Math.max(origin.y, h - origin.y),
        ),
    };

    if (ocs().reduced()) {
        apply();
        pending = null;

        return;
    }

    spinIcon(icon, next);
    const effect = pickEffect(last);
    last = effect.name;
    const oldBg = getComputedStyle(root).getPropertyValue('--bg');
    const start = (
        document as Document & { startViewTransition?: (cb: () => void) => VT }
    ).startViewTransition;

    if (!start) {
        apply();
        pending = null;
        overlay(c, oldBg, effect);

        return;
    }

    root.toggleAttribute('data-vt-old-top', effect.target === 'old');
    let vt: VT;

    try {
        vt = start.call(document, apply);
    } catch {
        apply();
        pending = null;
        root.removeAttribute('data-vt-old-top');
        overlay(c, oldBg, effect);

        return;
    }

    running = vt;
    // Only the latest switch may touch the theme: a click that cut this one short has its own target.
    const mine = () => running === vt;
    vt.updateCallbackDone.catch(() => mine() && apply());
    vt.ready
        .then(() => {
            root.animate(effect.keyframes(c), {
                duration: effect.duration,
                easing: effect.easing,
                fill: 'both',
                pseudoElement: `::view-transition-${effect.target}(root)`,
            });
        })
        .catch(() => {
            // Skipped by the browser (not by another click): make sure the theme is on, and still give the
            // switch its moment with the overlay sheet.
            if (mine()) {
                apply();
                root.removeAttribute('data-vt-old-top');
                overlay(c, oldBg, effect);
            }
        });
    vt.finished
        .catch(() => {})
        .finally(() => {
            if (mine()) {
                running = null;
                pending = null;
                root.removeAttribute('data-vt-old-top');
            }
        });
}
