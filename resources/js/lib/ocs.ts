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
