/*
 * The one bridge between React and the Orchid City kit (resources/ocs/ocs.js).
 *
 * ocs.js wires effects with OrchidCity.init(), a one-time DOM scan. React mounts nodes
 * after that scan and re-renders them, so components attach effects to their own node
 * through ocsRef() instead. Two kit effects rewrite a button's text (wave, decode); they
 * are only applied to plain-text labels, see components/ui/button.tsx.
 */
import * as anime from 'animejs';
import '../../ocs/ocs.js';

window.anime = anime;

export type OcsEffect =
    | 'magnetic'
    | 'wave'
    | 'decode'
    | 'squish'
    | 'tilt'
    | 'theme-toggle';

type OcsNode = HTMLElement & { __ocs?: boolean };

const attach: Record<OcsEffect, (el: HTMLElement) => void> = {
    magnetic: (el) => window.OrchidCity.magnetic(el),
    wave: (el) => window.OrchidCity.wave(el),
    decode: (el) => window.OrchidCity.decode(el),
    squish: (el) => window.OrchidCity.squish(el),
    tilt: (el) => window.OrchidCity.tilt(el),
    'theme-toggle': (el) => window.OrchidCity.themeToggle(el),
};

/** Attach kit effects to a node once, e.g. `ref={ocsRef(['magnetic', 'squish'])}`. */
export function ocsRef(effects: readonly OcsEffect[]) {
    return (el: HTMLElement | null) => {
        const node = el as OcsNode | null;

        if (!node || node.__ocs || effects.length === 0) {
            return;
        }

        node.__ocs = true;
        effects.forEach((effect) => attach[effect](node));
    };
}

export const ocs = () => window.OrchidCity;

/*
 * Luna-local effect, written the kit's way (one personality per theme, reduced motion
 * respected); a candidate to move up into orchid-city-ui's ocs.js.
 *
 * bloomTravel: the Bloom dock's orchid moves to a new tile. Luna is named after the Luna
 * orchid (an Orchid City Software tool), so the marker is a tiny five-petal bloom.
 *   LIGHT (paper): hops across, stamps down, and its petals pop open like a pressed flower.
 *   DARK  (code):  drifts over on a spring, turns one petal-step, and its petals breathe open.
 * Petals are the marker's [data-petal] elements.
 */
export function bloomTravel(
    marker: HTMLElement,
    toX: number,
    instant = false,
): void {
    const { animate, spring, stagger, utils } = anime;
    const petals = marker.querySelectorAll<SVGElement>('[data-petal]');

    if (instant || ocs().reduced()) {
        utils.set(marker, { x: toX, y: 0, scale: 1 });
        utils.set(petals, { scale: 1 });

        return;
    }

    if (ocs().isDark()) {
        animate(marker, {
            x: toX,
            ease: spring({ bounce: 0.3, duration: 800 }),
        });
        animate(marker, {
            y: [
                { to: -12, duration: 300, ease: 'outSine' },
                { to: 0, duration: 380, ease: 'inOutSine' },
            ],
            // Five petals: a 72-degree turn ends where it started, so it never looks tilted.
            rotate: { to: '+=72', duration: 700, ease: 'inOutQuad' },
        });
        animate(petals, {
            scale: [
                { to: 0.55, duration: 220, ease: 'outQuad' },
                { to: 1, duration: 520, ease: 'outBack(2)' },
            ],
            delay: stagger(45),
        });

        return;
    }

    animate(marker, { x: toX, duration: 280, ease: 'outCubic' });
    animate(marker, {
        y: [
            { to: -8, duration: 160, ease: 'outQuad' },
            { to: 0, duration: 120, ease: 'inQuad' },
        ],
        scale: [
            { to: 1, duration: 280 },
            { to: 1.3, duration: 60, ease: 'outQuad' },
            { to: 1, duration: 240, ease: 'outBack(3)' },
        ],
    });
    utils.set(petals, { scale: 0.35 });
    animate(petals, {
        scale: { to: 1, duration: 320, ease: 'outBack(3)' },
        delay: stagger(30, { start: 260 }),
    });
}

/*
 * brandPanelLand: the sign-in brand panel arrives, once (Luna-local; reduced motion = it's simply there;
 * nothing loops). Rows are the panel's [data-row] wallpaper lines, the badge is [data-badge].
 *   LIGHT (paper): the wallpaper rows slide in from alternate sides like sheets fed through a press,
 *                  then the badge is stamped down on top.
 *   DARK  (code):  the rows fade up row by row like lines of output, and the badge rises on a spring.
 */
export function brandPanelLand(panel: HTMLElement): void {
    const { animate, spring, stagger } = anime;
    const rows = panel.querySelectorAll<HTMLElement>('[data-row]');
    const badge = panel.querySelector<HTMLElement>('[data-badge]');

    if (ocs().reduced() || !badge) {
        return;
    }

    if (ocs().isDark()) {
        animate(rows, {
            opacity: { from: 0, to: 1, duration: 360, ease: 'outQuad' },
            y: { from: 10, to: 0, duration: 360, ease: 'outQuad' },
            delay: stagger(45),
        });
        animate(badge, {
            y: {
                from: 22,
                to: 0,
                ease: spring({ bounce: 0.45, duration: 900 }),
            },
            opacity: { from: 0, to: 1, duration: 380, ease: 'outQuad' },
            delay: 260,
        });

        return;
    }

    // Even rows come in from the left, odd rows from the right.
    [0, 1].forEach((side) => {
        animate(
            [...rows].filter((_, i) => i % 2 === side),
            {
                x: { from: side ? 60 : -60, to: 0 },
                duration: 520,
                ease: 'outCubic',
                delay: stagger(60, { start: side * 30 }),
            },
        );
    });
    animate(badge, {
        y: { from: -30, to: 0, duration: 300, ease: 'inQuad' },
        opacity: { from: 0, to: 1, duration: 100 },
        scale: [
            { from: 1.1, to: 1.1, duration: 300 },
            { to: 1, duration: 260, ease: 'outBack(3)' },
        ],
        delay: 280,
    });
}

/*
 * backHop: the Back button's hover, Luna-local like bloomTravel (one personality per theme, reduced
 * motion respected, nothing on touch: phones only get the kit's press).
 *   LIGHT (paper): the arrow takes a quick step back with two pencil motion lines behind it, and
 *                  the letters lean back the way you're going, like a cartoon about to dash off.
 *   DARK  (code):  the arrow springs back trailing a glowing ghost of itself, and the letters hop
 *                  in a wave that runs right to left (the kit's wave, reversed).
 * Parts: [data-back-arrow], [data-back-ghost], [data-back-line], [data-back-char].
 */
export function backHop(el: HTMLElement): () => void {
    const { animate, stagger, utils } = anime;
    const arrow = el.querySelector<HTMLElement>('[data-back-arrow]');
    const ghost = el.querySelector<HTMLElement>('[data-back-ghost]');
    const lines = el.querySelectorAll<HTMLElement>('[data-back-line]');
    const chars = el.querySelectorAll<HTMLElement>('[data-back-char]');

    const enter = (e: PointerEvent) => {
        if (ocs().reduced() || e.pointerType === 'touch' || !arrow) {
            return;
        }

        if (ocs().isDark()) {
            animate(arrow, {
                x: [
                    { to: -7, duration: 140, ease: 'outQuad' },
                    { to: 0, duration: 520, ease: 'outElastic(1, .5)' },
                ],
            });
            if (ghost) {
                utils.set(ghost, { x: 0, opacity: 0.6 });
                animate(ghost, {
                    x: 12,
                    opacity: 0,
                    duration: 520,
                    ease: 'outCubic',
                });
            }
            animate(chars, {
                y: [
                    { to: -4, duration: 140, ease: 'outQuad' },
                    { to: 0, duration: 260, ease: 'outBounce' },
                ],
                delay: stagger(28, { from: 'last' }),
            });

            return;
        }

        animate(arrow, {
            x: [
                { to: -6, duration: 150, ease: 'outQuad' },
                { to: 0, duration: 300, ease: 'outBack(3)' },
            ],
        });
        utils.set(lines, { scaleX: 0, opacity: 1 });
        animate(lines, {
            scaleX: [
                { to: 1, duration: 140, ease: 'outQuad' },
                { to: 0, duration: 260, ease: 'inQuad' },
            ],
            delay: stagger(50),
        });
        animate(chars, {
            skewX: [
                { to: 10, duration: 120 },
                { to: 0, duration: 280 },
            ],
            delay: stagger(14),
            ease: 'outQuad',
        });
    };

    el.addEventListener('pointerenter', enter);

    return () => el.removeEventListener('pointerenter', enter);
}

/*
 * bloomFan: the Bloom dock's middle bud opens and the overflow modules bloom out of it in an arc
 * (Luna-local, like bloomTravel). Items are the fan's [data-fan-item] tiles, each carrying its arc
 * position in data-x / data-y (px from the bud's centre); bud petals are [data-bud-petal].
 *   LIGHT (paper): the bud's petals snap open and the tiles are stamped out one by one on a quick
 *                  overshoot, like cards dealt from a press.
 *   DARK  (code):  the petals turn and breathe open, and the tiles drift out on a spring, fading up.
 * Closing folds everything back into the bud, quicker. Reduced motion = it just appears / goes.
 */
export function bloomFan(
    fan: HTMLElement,
    bud: HTMLElement,
    open: boolean,
): void {
    const { animate, spring, stagger, utils } = anime;
    const items = [...fan.querySelectorAll<HTMLElement>('[data-fan-item]')];
    const petals = bud.querySelectorAll<SVGElement>('[data-bud-petal]');
    const at = (el: HTMLElement) => ({
        x: Number(el.dataset.x),
        y: Number(el.dataset.y),
    });

    utils.remove(items);
    utils.remove(petals);

    if (ocs().reduced()) {
        items.forEach((el) =>
            utils.set(
                el,
                open
                    ? { ...at(el), scale: 1, opacity: 1 }
                    : { x: 0, y: 0, scale: 0, opacity: 0 },
            ),
        );
        utils.set(petals, { scale: open ? 1 : 0.55, rotate: open ? 36 : 0 });
        fan.style.visibility = open ? 'visible' : 'hidden';

        return;
    }

    if (open) {
        fan.style.visibility = 'visible';
        utils.set(items, { x: 0, y: 0, scale: 0, opacity: 0 });
    }

    const dark = ocs().isDark();

    animate(petals, {
        scale: open ? 1 : 0.55,
        rotate: open ? 36 : 0,
        duration: open ? 420 : 240,
        ease: open ? (dark ? 'outElastic(1, .6)' : 'outBack(3)') : 'inQuad',
        delay: stagger(open ? 30 : 15),
    });

    if (!open) {
        let left = items.length;
        items.forEach((el, i) =>
            animate(el, {
                x: 0,
                y: 0,
                scale: 0,
                opacity: 0,
                duration: 200,
                ease: 'inQuad',
                delay: (items.length - 1 - i) * 25,
                onComplete: () => {
                    left -= 1;

                    if (left === 0) {
                        fan.style.visibility = 'hidden';
                    }
                },
            }),
        );

        if (items.length === 0) {
            fan.style.visibility = 'hidden';
        }

        return;
    }

    items.forEach((el, i) => {
        const { x, y } = at(el);

        if (dark) {
            animate(el, {
                x: { to: x, ease: spring({ bounce: 0.35, duration: 700 }) },
                y: { to: y, ease: spring({ bounce: 0.35, duration: 700 }) },
                scale: { to: 1, duration: 420, ease: 'outQuad' },
                opacity: { to: 1, duration: 300, ease: 'outQuad' },
                delay: i * 45,
            });

            return;
        }

        animate(el, {
            x: { to: x, duration: 300, ease: 'outBack(1.8)' },
            y: { to: y, duration: 300, ease: 'outBack(1.8)' },
            scale: [
                { to: 1.12, duration: 220, ease: 'outQuad' },
                { to: 1, duration: 160, ease: 'outBack(3)' },
            ],
            opacity: { to: 1, duration: 120 },
            delay: i * 30,
        });
    });
}

/*
 * ringBell: a notification arrived (Luna-local, one personality per theme; reduced motion = no motion,
 * the count badge alone says it). Parts: [data-bell-icon], [data-bell-badge].
 *   LIGHT (paper): the bell is struck: a quick ink wobble that settles fast, then the badge is stamped on.
 *   DARK  (code):  the bell sways on a spring, and the badge pops in with a violet glow that fades.
 */
export function ringBell(el: HTMLElement): void {
    const { animate, spring } = anime;
    const icon = el.querySelector<HTMLElement>('[data-bell-icon]');
    const badge = el.querySelector<HTMLElement>('[data-bell-badge]');

    if (ocs().reduced() || !icon) {
        return;
    }

    if (ocs().isDark()) {
        animate(icon, {
            rotate: {
                from: 18,
                to: 0,
                ease: spring({ bounce: 0.6, duration: 900 }),
            },
        });
        if (badge) {
            // The token's value, not var(): Anime interpolates real colours only (tokens are #rrggbb).
            const glow = getComputedStyle(document.documentElement)
                .getPropertyValue('--primary')
                .trim();
            animate(badge, {
                scale: {
                    from: 0.4,
                    to: 1,
                    ease: spring({ bounce: 0.5, duration: 700 }),
                },
                boxShadow: [
                    {
                        from: `0 0 0px 0px ${glow}`,
                        to: `0 0 14px 2px ${glow}`,
                        duration: 200,
                    },
                    {
                        to: `0 0 0px 0px ${glow}00`,
                        duration: 600,
                        ease: 'outQuad',
                    },
                ],
            });
        }

        return;
    }

    animate(icon, {
        rotate: [
            { to: -16, duration: 70, ease: 'outQuad' },
            { to: 12, duration: 90 },
            { to: -6, duration: 90 },
            { to: 0, duration: 160, ease: 'outBack(3)' },
        ],
    });
    if (badge) {
        animate(badge, {
            y: { from: -8, to: 0, duration: 180, ease: 'inQuad' },
            scale: [
                { from: 1.3, to: 1.3, duration: 180 },
                { to: 1, duration: 220, ease: 'outBack(3)' },
            ],
        });
    }
}

/*
 * The pet on Home (Luna-local, spec 2026-11-24-luna-pet). Parts: [data-pet-body], [data-pet-eye],
 * [data-pet-glow] inside the sprite; petFed / petGrow move the wrapper itself so they never fight
 * the idle bob. Reduced motion = a still sprite.
 *   LIGHT (paper): short, stamp-like moves: a small step bob, a squish-and-hop that lands hard,
 *                  and growth stamped on with an overshoot.
 *   DARK  (code):  softer springs: a slow float with breathing glow, a springy hop, and growth that
 *                  swells in on a spring while the glow flares.
 */
export function petIdle(el: HTMLElement): () => void {
    // The kit sets data-theme before it announces "ocs:theme", so a restart picks the new personality.
    let stop = petIdleOnce(el);
    const restart = () => {
        stop();
        stop = petIdleOnce(el);
    };
    document.addEventListener('ocs:theme', restart);

    return () => {
        document.removeEventListener('ocs:theme', restart);
        stop();
    };
}

function petIdleOnce(el: HTMLElement): () => void {
    const { animate } = anime;
    const body = el.querySelector<SVGElement>('[data-pet-body]');
    const eyes = el.querySelectorAll<SVGElement>('[data-pet-eye]');
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced() || !body) {
        return () => {};
    }

    const dark = ocs().isDark();
    const running = [
        animate(body, {
            y: dark ? -4 : -2,
            duration: dark ? 1800 : 900,
            ease: dark ? 'inOutSine' : 'inOutQuad',
            loop: true,
            alternate: true,
        }),
    ];
    if (dark && glow.length) {
        running.push(
            animate(glow, {
                opacity: { from: 0.12, to: 0.3 },
                duration: 1800,
                ease: 'inOutSine',
                loop: true,
                alternate: true,
            }),
        );
    }
    const blink = window.setInterval(() => {
        animate(eyes, {
            scaleY: [
                { to: 0.1, duration: 70 },
                { to: 1, duration: 120 },
            ],
        });
    }, 3600);

    return () => {
        window.clearInterval(blink);
        running.forEach((a) => a.revert());
    };
}

export function petFed(el: HTMLElement): void {
    const { animate, spring } = anime;

    if (ocs().reduced()) {
        return;
    }

    if (ocs().isDark()) {
        animate(el, {
            scaleX: [
                { to: 1.12, duration: 160 },
                { to: 1, ease: spring({ bounce: 0.6, duration: 700 }) },
            ],
            scaleY: [
                { to: 0.86, duration: 160 },
                { to: 1, ease: spring({ bounce: 0.6, duration: 700 }) },
            ],
            y: [
                { to: -12, duration: 260, delay: 160, ease: 'outQuad' },
                { to: 0, ease: spring({ bounce: 0.5, duration: 600 }) },
            ],
        });

        return;
    }

    animate(el, {
        scaleX: [
            { to: 1.14, duration: 90 },
            { to: 1, duration: 120 },
            { to: 1.08, duration: 60, delay: 200 },
            { to: 1, duration: 100 },
        ],
        scaleY: [
            { to: 0.84, duration: 90 },
            { to: 1, duration: 120 },
            { to: 0.9, duration: 60, delay: 200 },
            { to: 1, duration: 100 },
        ],
        y: [
            { to: -10, duration: 160, delay: 90, ease: 'outQuad' },
            { to: 0, duration: 160, ease: 'inQuad' },
        ],
    });
}

export function petGrow(el: HTMLElement): void {
    const { animate, spring } = anime;
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced()) {
        return;
    }

    if (ocs().isDark()) {
        animate(el, {
            scale: {
                from: 0.6,
                to: 1,
                ease: spring({ bounce: 0.55, duration: 1100 }),
            },
        });
        if (glow.length) {
            animate(glow, {
                opacity: [
                    { from: 0, to: 0.5, duration: 300 },
                    { to: 0.2, duration: 900, ease: 'outQuad' },
                ],
            });
        }

        return;
    }

    animate(el, {
        scale: [
            { from: 0.7, to: 1.12, duration: 180, ease: 'outQuad' },
            { to: 1, duration: 260, ease: 'outBack(3)' },
        ],
        rotate: [
            { from: -6, to: 3, duration: 180 },
            { to: 0, duration: 260, ease: 'outBack(3)' },
        ],
    });
}

/*
 * petPoke: the pet was tapped in its panel (cosmetic, no XP). Moves the wrapper, like petFed.
 *   LIGHT (paper): a quick squish and a side-to-side wobble that settles hard.
 *   DARK  (code):  a springy jump while its glow flares.
 */
export function petPoke(el: HTMLElement): void {
    const { animate, spring } = anime;
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced()) {
        return;
    }

    if (ocs().isDark()) {
        animate(el, {
            y: [
                { to: -18, duration: 220, ease: 'outQuad' },
                { to: 0, ease: spring({ bounce: 0.6, duration: 800 }) },
            ],
        });
        if (glow.length) {
            animate(glow, {
                opacity: [
                    { to: 0.5, duration: 200 },
                    { to: 0.2, duration: 700, ease: 'outQuad' },
                ],
            });
        }

        return;
    }

    animate(el, {
        scaleX: [
            { to: 1.12, duration: 80 },
            { to: 1, duration: 160, ease: 'outBack(3)' },
        ],
        scaleY: [
            { to: 0.86, duration: 80 },
            { to: 1, duration: 160, ease: 'outBack(3)' },
        ],
        rotate: [
            { to: -8, duration: 90, delay: 80 },
            { to: 6, duration: 90 },
            { to: 0, duration: 140, ease: 'outBack(3)' },
        ],
    });
}
