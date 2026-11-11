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
