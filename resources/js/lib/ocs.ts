/*
 * The one bridge between React and the Orchid City kit (resources/ocs/ocs.js).
 *
 * ocs.js wires effects with OrchidCity.init(), a one-time DOM scan. React mounts nodes
 * after that scan and re-renders them, so components attach effects to their own node
 * through ocsRef() instead. Two kit effects rewrite a button's text (wave, decode); they
 * are only applied to plain-text labels, see components/ui/button.tsx.
 */
import * as anime from 'animejs';
import type { AnimationParams } from 'animejs';
import '../../ocs/ocs.js';
import { blinkPlan, fidgetFor, GAZE_RADIUS } from './pet-play';

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
 * The pet on Home and in its panel (Luna-local, specs 2026-11-24-luna-pet and 2026-11-26-luna-moonling-redesign).
 * The sprite's layers: [data-pet-lean] (pet-play) > [data-pet-body] (float, wiggle) > [data-pet-hop] (hops) >
 * [data-pet-breath] (breathing), with [data-pet-shadow] on the ground. petGrow moves the wrapper itself so it never
 * fights the idle loops. Reduced motion = a still sprite: no idle, no fidgets, no hearts or z's.
 *   LIGHT (paper): short, stamp-like moves: quick breaths, a hop that lands hard, growth stamped on with an overshoot.
 *   DARK  (code):  softer springs: slow breaths under a float with breathing glow, a hop that lands on a spring, and
 *                  growth that swells in while the glow flares.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const HEART = 'M0 2C-1 -1 -6 -1 -6 3C-6 6 -2 8 0 10C2 8 6 6 6 3C6 -1 1 -1 0 2Z';
const ZED = 'M0 0h6l-6 7h6';

const spriteOf = (el: HTMLElement) => el.querySelector('svg');

/** Shows a passing face (resources/css/app.css) for `ms`, unless another one replaced it. */
function petFace(el: HTMLElement, face: 'happy' | 'surprised', ms: number) {
    const svg = spriteOf(el);
    svg?.setAttribute?.('data-pet-react', face);
    window.setTimeout(() => {
        if (svg?.getAttribute?.('data-pet-react') === face) {
            svg.removeAttribute('data-pet-react');
        }
    }, ms);
}

/** Floats a small shape up from (x, y) in the sprite's empty [data-pet-fx] layer, then removes it. */
function petPuff(
    el: HTMLElement,
    shape: 'heart' | 'zed',
    x: number,
    y: number,
    delay = 0,
) {
    const fx = el.querySelector('[data-pet-fx]');
    if (!fx?.appendChild) {
        return;
    }
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', shape === 'heart' ? HEART : ZED);
    p.setAttribute('fill', shape === 'heart' ? 'var(--pet-mark)' : 'none');
    p.setAttribute('stroke', 'var(--pet-line)');
    p.setAttribute('stroke-width', shape === 'heart' ? '1.5' : '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('paint-order', 'stroke');
    p.style.transformBox = 'fill-box';
    p.style.transformOrigin = '50% 50%';
    p.style.opacity = '0';
    g.appendChild(p);
    fx.appendChild(g);
    const long = shape === 'zed' ? 2200 : 1200;
    anime.animate(p, {
        y: { from: 0, to: shape === 'zed' ? -22 : -26 },
        x: { from: 0, to: shape === 'zed' ? 10 : (x - 60) / 6 },
        scale: [
            { from: 0.3, to: 1.1, duration: long * 0.25 },
            { to: shape === 'zed' ? 1.3 : 0.9, duration: long * 0.75 },
        ],
        opacity: [
            { from: 0, to: 1, duration: long * 0.25 },
            { to: 0, duration: long * 0.75 },
        ],
        delay,
        ease: 'outQuad',
        onComplete: () => g.remove(),
    });
}

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
    const breath = el.querySelector<SVGElement>('[data-pet-breath]');
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced() || !body) {
        return () => {};
    }

    const dark = ocs().isDark();
    const mood = spriteOf(el)?.getAttribute?.('data-pet-mood');
    const sleepy = mood === 'droopy' || mood === 'gloomy';
    // Droopy and gloomy breathe at half speed.
    const slow = sleepy ? 2 : 1;
    const running: ReturnType<typeof animate>[] = [];
    if (breath) {
        running.push(
            animate(breath, {
                scaleY: dark ? 1.04 : 1.03,
                scaleX: dark ? 0.98 : 0.985,
                duration: (dark ? 1600 : 1100) * slow,
                ease: 'inOutSine',
                loop: true,
                alternate: true,
            }),
        );
    }
    if (dark) {
        running.push(
            animate(body, {
                y: -4,
                duration: 1800 * slow,
                ease: 'inOutSine',
                loop: true,
                alternate: true,
            }),
        );
        if (glow.length) {
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
    }
    // Worn items with an idle move (spec 2026-11-26-luna-moonling-style, slice 10); dark is slower and softer.
    el.querySelectorAll('[data-pet-wear-idle]').forEach((part) => {
        const move = WEAR_IDLE[part.getAttribute('data-pet-wear-idle') ?? ''];
        if (move) {
            running.push(
                animate(part, {
                    ...move.to,
                    duration: move.duration * (dark ? 1.4 : 1),
                    ease: 'inOutSine',
                    loop: true,
                    alternate: true,
                }),
            );
        }
    });

    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
        const t = window.setTimeout(() => {
            timers.delete(t);
            fn();
        }, ms);
        timers.add(t);
    };
    const shut = (eyes: NodeListOf<SVGElement>) =>
        animate(eyes, {
            scaleY: [
                { to: 0.1, duration: 70 },
                { to: 1, duration: 120 },
            ],
        });
    // Blinks at random, now and then twice (lib/pet-play blinkPlan); read the eyes each time, as the mood redraws them.
    const blink = () => {
        const plan = blinkPlan(Math.random(), Math.random());
        later(() => {
            const eyes = el.querySelectorAll<SVGElement>('[data-pet-eye]');
            if (eyes.length) {
                shut(eyes);
                if (plan.double) {
                    later(() => shut(eyes), 240);
                }
            }
            blink();
        }, plan.delay);
    };
    blink();
    if (sleepy) {
        const doze = () =>
            later(() => {
                petPuff(el, 'zed', 82, 30);
                doze();
            }, 1600);
        doze();
    } else {
        const fidget = () =>
            later(
                () => {
                    petFidget(el);
                    fidget();
                },
                3500 + Math.random() * 3000,
            );
        fidget();
    }

    return () => {
        timers.forEach((t) => window.clearTimeout(t));
        timers.clear();
        running.forEach((a) => a.revert());
    };
}

/** One small idle move (lib/pet-play fidgetFor): look around, wave, a small hop or a wiggle. Not mid-reaction. */
function petFidget(el: HTMLElement): void {
    const { animate } = anime;
    const svg = spriteOf(el);

    if (
        ocs().reduced() ||
        document.hidden ||
        svg?.hasAttribute?.('data-pet-react')
    ) {
        return;
    }

    const gaze = el.querySelector('[data-pet-gaze]');
    const lean = el.querySelector<SVGElement>('[data-pet-lean]');
    // A held item is drawn apart from the arm, so a busy hand doesn't wave.
    const arm = svg?.hasAttribute?.('data-pet-hand')
        ? null
        : el.querySelector('[data-pet-arm="right"]');
    const body = el.querySelector('[data-pet-body]');
    const wobble = ocs().isDark() ? 1.3 : 1;

    switch (fidgetFor(Math.random(), { arms: !!arm, gaze: !!gaze })) {
        case 'look': {
            const look = (x: number) => {
                gaze?.setAttribute('transform', `translate(${x} 0)`);
                if (lean) {
                    lean.style.transform = x ? `rotate(${x}deg)` : '';
                }
            };
            look(-GAZE_RADIUS);
            window.setTimeout(() => look(GAZE_RADIUS), 650 * wobble);
            window.setTimeout(() => look(0), 1300 * wobble);
            break;
        }
        case 'wave':
            animate(arm!, {
                rotate: [
                    { to: -70, duration: 250 * wobble },
                    { to: -45, duration: 180 * wobble },
                    { to: -70, duration: 180 * wobble },
                    { to: 0, duration: 350 * wobble },
                ],
                ease: 'inOutSine',
            });
            break;
        case 'hop':
            petHop(el, 0.45);
            break;
        default:
            if (body) {
                animate(body, {
                    rotate: [
                        { to: -7, duration: 140 * wobble },
                        { to: 6, duration: 150 * wobble },
                        { to: -3, duration: 150 * wobble },
                        { to: 0, duration: 200 * wobble },
                    ],
                    ease: 'inOutSine',
                });
            }
    }
}

/**
 * petHop: crouch, stretch up, squash on landing and settle, on [data-pet-hop]; the arms trail and the shadow shrinks
 * while it's up. `size` scales the height (a fidget hops at under half). LIGHT lands hard; DARK lands on a spring.
 */
export function petHop(el: HTMLElement, size = 1): void {
    const { animate, spring } = anime;
    const hop = el.querySelector('[data-pet-hop]');

    if (ocs().reduced() || !hop) {
        return;
    }

    const dark = ocs().isDark();
    const t = dark ? 1.25 : 1;
    const h = 22 * size;
    const s = (v: number) => 1 + (v - 1) * Math.max(0.5, size);
    const settle = dark
        ? { to: 1, ease: spring({ bounce: 0.55, duration: 650 }) }
        : { to: 1, duration: 220, ease: 'outBack(3)' };
    // Crouch 110, launch 120, in the air 330, land 90, settle.
    animate(hop, {
        scaleX: [
            { to: s(1.14), duration: 110 * t },
            { to: s(0.9), duration: 120 * t },
            { to: s(0.98), duration: 330 * t },
            { to: s(1.16), duration: 90 * t },
            settle,
        ],
        scaleY: [
            { to: s(0.84), duration: 110 * t },
            { to: s(1.14), duration: 120 * t },
            { to: s(1.02), duration: 330 * t },
            { to: s(0.82), duration: 90 * t },
            settle,
        ],
        y: [
            { to: 0, duration: 110 * t },
            { to: -h, duration: 280 * t, ease: 'outQuad' },
            { to: 0, duration: 170 * t, ease: 'inQuad' },
        ],
    });
    const shadow = el.querySelector('[data-pet-shadow]');
    if (shadow) {
        animate(shadow, {
            scale: [
                { to: 1.1, duration: 110 * t },
                { to: 1 - 0.45 * size, duration: 280 * t, ease: 'outQuad' },
                { to: 1.15, duration: 170 * t, ease: 'inQuad' },
                { to: 1, duration: 310 * t },
            ],
        });
    }
    if (!spriteOf(el)?.hasAttribute?.('data-pet-hand')) {
        el.querySelectorAll('[data-pet-arm]').forEach((arm) => {
            const side = arm.getAttribute('data-pet-arm') === 'left' ? 1 : -1;
            animate(arm, {
                rotate: [
                    { to: 0, duration: 230 * t },
                    {
                        to: side * 35 * size,
                        duration: 200 * t,
                        ease: 'outQuad',
                    },
                    { to: side * -12 * size, duration: 220 * t },
                    { to: 0, duration: 260 * t, ease: 'outBack(2)' },
                ],
            });
        });
    }
}

export function petFed(el: HTMLElement): void {
    petHop(el);
}

/**
 * petGrow: the pet reached a new stage. `from` is the old stage's outline (pet-sprite outlinePath), which the body
 * morphs out of (anime.js svg.morphTo) while the whole pet grows in.
 */
export function petGrow(el: HTMLElement, from?: string): void {
    const { animate, spring } = anime;
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced()) {
        return;
    }

    const dark = ocs().isDark();
    const shape = el.querySelector<SVGPathElement>('path[data-pet-outline]');
    const fx = el.querySelector('[data-pet-fx]');
    const to = shape?.getAttribute('d');
    if (from && shape && fx && to && anime.svg?.morphTo) {
        const target = document.createElementNS(SVG_NS, 'path');
        target.setAttribute('d', to);
        target.setAttribute('fill', 'none');
        fx.appendChild(target);
        shape.setAttribute('d', from);
        animate(shape, {
            d: anime.svg.morphTo(target),
            duration: dark ? 1100 : 600,
            ease: dark ? 'outElastic(1, .6)' : 'outBack(2)',
            onComplete: () => {
                target.remove();
                shape.setAttribute('d', to);
            },
        });
    }

    if (dark) {
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
 * petPoke: the pet was tapped in its panel (cosmetic, no XP): a surprised face with wide eyes, then a hop.
 *   LIGHT (paper): a quick start and a small hop that lands hard.
 *   DARK  (code):  a higher, springy hop while its glow flares.
 */
export function petPoke(el: HTMLElement): void {
    const { animate } = anime;
    const glow = el.querySelectorAll<SVGElement>('[data-pet-glow]');

    if (ocs().reduced()) {
        return;
    }

    el.querySelectorAll('[data-pet-wear-tap]').forEach(petWearTap);

    const dark = ocs().isDark();
    petFace(el, 'surprised', 320);
    const eyes = el.querySelectorAll('[data-pet-eye]');
    if (eyes.length) {
        animate(eyes, {
            scale: [
                { to: 1.25, duration: 120 },
                { to: 1, duration: 260, ease: 'outBack(3)' },
            ],
        });
    }
    window.setTimeout(() => petHop(el, dark ? 0.8 : 0.6), 180);
    if (dark && glow.length) {
        animate(glow, {
            opacity: [
                { to: 0.5, duration: 200 },
                { to: 0.2, duration: 700, ease: 'outQuad' },
            ],
        });
    }
}

/**
 * petPet: the pet was stroked (lib/pet-play isPetStroke; cosmetic, no XP): happy eyes, a deeper blush, a little sway
 * and three hearts floating up. Not again while it's still happy.
 */
export function petPet(el: HTMLElement): void {
    const { animate } = anime;
    const svg = spriteOf(el);

    if (ocs().reduced() || svg?.getAttribute?.('data-pet-react') === 'happy') {
        return;
    }

    const wobble = ocs().isDark() ? 1.3 : 1;
    petFace(el, 'happy', 1600);
    const blush = el.querySelector('[data-pet-blush]');
    if (blush) {
        animate(blush, {
            opacity: [
                { to: 0.95, duration: 300 },
                { to: 0.95, duration: 900 },
                { to: 0.55, duration: 400 },
            ],
        });
    }
    const hop = el.querySelector('[data-pet-hop]');
    if (hop) {
        animate(hop, {
            rotate: [
                { to: -5, duration: 220 * wobble },
                { to: 5, duration: 240 * wobble },
                { to: -3, duration: 220 * wobble },
                { to: 0, duration: 220 * wobble },
            ],
            ease: 'inOutSine',
        });
    }
    petPuff(el, 'heart', 44, 30);
    petPuff(el, 'heart', 76, 30, 220);
    petPuff(el, 'heart', 60, 24, 440);
}

/** Worn items' idle loops, by the sprite's data-pet-wear-idle name (each runs there and back). */
const WEAR_IDLE: Record<string, { to: AnimationParams; duration: number }> = {
    spin: { to: { scaleX: { from: 1, to: -1 } }, duration: 700 },
    flap: { to: { scaleX: { from: 1, to: 0.78 } }, duration: 520 },
    bob: { to: { y: -3, rotate: 4 }, duration: 1400 },
    sway: { to: { rotate: { from: -4, to: 4 } }, duration: 1600 },
    flicker: { to: { opacity: { from: 0.35, to: 0.85 } }, duration: 900 },
    float: { to: { y: -2 }, duration: 1500 },
    // Slice 16 (collection): a mug's steam rises and fades.
    steam: { to: { y: -4, opacity: { from: 0.2, to: 0.8 } }, duration: 1300 },
};

/*
 * petWearTap: one worn item's own move, by its data-pet-wear-tap name: when the moonling is tapped (petPoke runs it
 * for every worn item) or when the item itself is tapped in the panel. Cosmetic, no XP. Reduced motion: none.
 */
export function petWearTap(part: Element): void {
    const { animate, spring } = anime;

    if (ocs().reduced()) {
        return;
    }

    const back = (ms: number) => ({ to: 1, duration: ms, ease: 'outBack(3)' });
    const moves: Record<string, AnimationParams> = {
        twinkle: {
            scale: [{ to: 1.5, duration: 120 }, back(260)],
            rotate: { from: 0, to: 72, duration: 380 },
        },
        wiggle: {
            rotate: [
                { to: -15, duration: 80 },
                { to: 12, duration: 90 },
                { to: -8, duration: 90 },
                { to: 0, duration: 140 },
            ],
        },
        spin: {
            scaleX: [-1, 1, -1, 1, -1, 1].map((to) => ({ to, duration: 90 })),
        },
        glint: {
            opacity: [
                { to: 0.4, duration: 90 },
                { to: 1, duration: 160 },
            ],
            scale: [{ to: 1.12, duration: 90 }, back(200)],
        },
        flutter: {
            scaleX: [0.6, 1, 0.6, 1, 0.6, 1].map((to) => ({
                to,
                duration: 70,
            })),
        },
        billow: { scaleX: [{ to: 1.25, duration: 160 }, back(320)] },
        jump: {
            y: [
                { to: -14, duration: 200, ease: 'outQuad' },
                { to: 0, ease: spring({ bounce: 0.6, duration: 700 }) },
            ],
        },
        burst: {
            scale: [{ to: 1.6, duration: 140 }, back(300)],
            rotate: { from: 0, to: 180, duration: 440 },
        },
        // Slice 16 (collection): the umbrella's raindrops fall away and come back.
        drip: {
            y: [
                { to: 9, duration: 420, ease: 'inQuad' },
                { to: 0, duration: 0 },
            ],
            opacity: [
                { to: 0, duration: 420 },
                { to: 1, duration: 0 },
            ],
        },
        flare: {
            opacity: [
                { to: 1, duration: 120 },
                { to: 0.6, duration: 500 },
            ],
            scale: [{ to: 1.25, duration: 120 }, back(400)],
        },
    };
    const move = moves[part.getAttribute('data-pet-wear-tap') ?? ''];

    if (move) {
        animate(part, move);
    }
}

/*
 * duelReveal: a moon duel's result (spec 2026-11-25-luna-pet-social). Parts: [data-duel-pick] (both moves),
 * [data-duel-winner], [data-duel-loser] (none on a draw). Reduced motion = the result text alone.
 *   LIGHT (paper): the moves are stamped down one after the other, the winner hops once, the loser flattens.
 *   DARK  (code):  the moves flip over on a spring, the winner floats up with a glow, the loser sinks and dims.
 */
export function duelReveal(el: HTMLElement): void {
    const { animate, spring, stagger } = anime;
    const picks = el.querySelectorAll<HTMLElement>('[data-duel-pick]');
    const winner = el.querySelector<HTMLElement>('[data-duel-winner]');
    const loser = el.querySelector<HTMLElement>('[data-duel-loser]');

    if (ocs().reduced()) {
        return;
    }

    if (ocs().isDark()) {
        animate(picks, {
            rotateY: {
                from: 90,
                to: 0,
                ease: spring({ bounce: 0.5, duration: 700 }),
            },
            opacity: { from: 0, to: 1, duration: 250 },
            delay: stagger(220),
        });
        if (winner) {
            const glow = getComputedStyle(document.documentElement)
                .getPropertyValue('--primary')
                .trim();
            animate(winner, {
                y: [
                    { to: -14, duration: 360, delay: 700, ease: 'outQuad' },
                    { to: 0, ease: spring({ bounce: 0.5, duration: 800 }) },
                ],
                filter: [
                    {
                        from: `drop-shadow(0 0 0px ${glow})`,
                        to: `drop-shadow(0 0 12px ${glow})`,
                        duration: 360,
                        delay: 700,
                    },
                    { to: `drop-shadow(0 0 0px ${glow})`, duration: 900 },
                ],
            });
        }
        if (loser) {
            animate(loser, {
                y: { to: 4, duration: 500, delay: 700, ease: 'outQuad' },
                opacity: { to: 0.55, duration: 500, delay: 700 },
            });
        }

        return;
    }

    animate(picks, {
        scale: [
            { from: 1.6, to: 0.92, duration: 140, ease: 'inQuad' },
            { to: 1, duration: 160, ease: 'outBack(3)' },
        ],
        opacity: { from: 0, to: 1, duration: 100 },
        delay: stagger(260),
    });
    if (winner) {
        animate(winner, {
            y: [
                { to: -12, duration: 160, delay: 640, ease: 'outQuad' },
                { to: 0, duration: 160, ease: 'inQuad' },
            ],
        });
    }
    if (loser) {
        animate(loser, {
            scaleY: { to: 0.8, duration: 140, delay: 640, ease: 'outQuad' },
            scaleX: { to: 1.12, duration: 140, delay: 640, ease: 'outQuad' },
        });
    }
}
