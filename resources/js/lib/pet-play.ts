/*
 * Playing with the moonling (spec 2026-11-25-luna-moonling-life, slice 5): its eyes follow the pointer, a
 * press-and-drag tugs it (it leans and stretches, then springs back; it never leaves its spot), and the
 * arrow keys make it glance. The maths is pure so it can be tested; `usePetPlay` wires it to the DOM.
 * Reduced motion: no gaze and no tug; taps still count.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

/** How far the eyes move, in sprite units (the sprite is 120 wide). */
export const GAZE_RADIUS = 3;

const MAX_LEAN = 12;
const MAX_STRETCH = 0.15;

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 1000) / 1000 || 0;

/** Where the eyes look for a pointer at (px, py): full radius from half the box away, less when closer. */
export function gazeOffset(
    px: number,
    py: number,
    box: Box,
    reduced = false,
): Point {
    const dx = px - (box.left + box.width / 2);
    const dy = py - (box.top + box.height / 2);
    const distance = Math.hypot(dx, dy);

    if (reduced || distance === 0) {
        return { x: 0, y: 0 };
    }

    const reach = Math.max(box.width, box.height) / 2;
    const r = Math.min(GAZE_RADIUS, (distance / reach) * GAZE_RADIUS);

    return { x: round((dx / distance) * r), y: round((dy / distance) * r) };
}

/** The tug: lean toward the pull (degrees) and stretch (scaleY), both capped. */
export function tugPose(
    dx: number,
    dy: number,
    size: number,
    reduced = false,
): { rotate: number; scaleY: number } {
    if (reduced) {
        return { rotate: 0, scaleY: 1 };
    }

    const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (dx / size) * 24));
    const stretch = Math.min(MAX_STRETCH, (Math.hypot(dx, dy) / size) * 0.3);

    return { rotate: round(lean), scaleY: round(1 + stretch) };
}

/** An arrow key's glance, or null for any other key. */
export function glanceFor(key: string): Point | null {
    const r = GAZE_RADIUS;

    return (
        {
            ArrowLeft: { x: -r, y: 0 },
            ArrowRight: { x: r, y: 0 },
            ArrowUp: { x: 0, y: -r },
            ArrowDown: { x: 0, y: r },
        }[key] ?? null
    );
}

/** The next blink (spec 2026-11-26-luna-moonling-redesign): a random 1.8–5.2 s wait, a quarter of them double. */
export function blinkPlan(
    wait: number,
    roll: number,
): { delay: number; double: boolean } {
    return { delay: Math.round(1800 + wait * 3400), double: roll < 0.25 };
}

export type Fidget = 'look' | 'wave' | 'hop' | 'wiggle';

/** An idle fidget from a roll in [0, 1): it only waves with arms and looks around with eyes. */
export function fidgetFor(
    roll: number,
    has: { arms: boolean; gaze: boolean },
): Fidget {
    const can: Fidget[] = [
        ...(has.gaze ? (['look'] as const) : []),
        ...(has.arms ? (['wave'] as const) : []),
        ...(has.gaze ? (['hop'] as const) : []),
        'wiggle',
    ];

    return can[Math.min(can.length - 1, Math.floor(roll * can.length))];
}

const MAX_TILT = 5;

/** The lean toward a pointer `dx` from the sprite's centre, in degrees, capped. */
export function leanFor(dx: number, width: number, reduced = false): number {
    if (reduced || width <= 0) {
        return 0;
    }

    return round(Math.max(-MAX_TILT, Math.min(MAX_TILT, (dx / width) * 10)));
}

/** Petting: the pointer has stroked over twice the sprite's width. */
export function isPetStroke(path: number, size: number): boolean {
    return path > size * 2;
}

/**
 * Where the speech bubble's tail ends, in px from the top of its box: a small gap above the drawing's real top (`drawnTop`, in
 * the sprite's 120-unit viewBox, items included), for an svg `svgSize` px tall starting `svgTop` px down the box.
 */
export function bubbleBottom({
    svgTop,
    svgSize,
    drawnTop,
}: {
    svgTop: number;
    svgSize: number;
    drawnTop: number;
}): number {
    return Math.max(0, round(svgTop + (drawnTop * svgSize) / 120 - 8));
}

const reducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Wires play to a sprite wrapper. `area`: where the eyes follow a mouse (the panel; the card itself on Home).
 * With `tug`, a press on the wrapper tugs the pet, and every press (tug or plain tap) calls `onTap` once on
 * release; keyboard taps come through the button's own click. Arrow keys on the wrapper glance.
 */
export function usePetPlay(
    wrapper: RefObject<HTMLElement | null>,
    {
        area,
        tug = false,
        onTap,
        onPet,
        active = true,
    }: {
        area?: RefObject<HTMLElement | null>;
        tug?: boolean;
        onTap?: () => void;
        /** Stroking the pet: a mouse moving over it, or a finger dragging on it. */
        onPet?: () => void;
        active?: boolean;
    },
): void {
    useEffect(() => {
        if (!active) {
            return;
        }

        // Bind on the next frame: a dialog mounts its content after the commit that opens it.
        let unbind = () => {};
        const frame = requestAnimationFrame(() => {
            unbind = bind();
        });

        return () => {
            cancelAnimationFrame(frame);
            unbind();
        };
    }, [wrapper, area, tug, onTap, onPet, active]);

    function bind(): () => void {
        const el = wrapper.current;
        const zone = area?.current ?? el;

        if (!el || !zone) {
            return () => {};
        }

        // Keys reach the button the sprite sits in, not the sprite.
        const keys = el.closest('button') ?? el;

        const look = (p: Point) =>
            el
                .querySelectorAll('[data-pet-gaze]')
                .forEach((g) =>
                    g.setAttribute('transform', `translate(${p.x} ${p.y})`),
                );
        const box = () => el.querySelector('svg')?.getBoundingClientRect();
        const lean = (deg: number) =>
            el
                .querySelectorAll<SVGElement>('[data-pet-lean]')
                .forEach(
                    (g) => (g.style.transform = deg ? `rotate(${deg}deg)` : ''),
                );
        let down: { x: number; y: number; id: number } | null = null;
        let glance = 0;
        let stroked = 0;

        const follow = (e: PointerEvent) => {
            const b = box();
            // A mouse anywhere in the area; a finger only while it's pressing the pet.
            if (b && (e.pointerType === 'mouse' || down)) {
                look(gazeOffset(e.clientX, e.clientY, b, reducedMotion()));
                lean(
                    leanFor(
                        e.clientX - (b.left + b.width / 2),
                        b.width,
                        reducedMotion(),
                    ),
                );
            }
        };
        const rest = () => {
            if (!down) {
                look({ x: 0, y: 0 });
                lean(0);
            }
        };
        // Stroking: the pointer's path over the pet itself, a mouse hovering or a finger pressing.
        const stroke = (e: PointerEvent) => {
            const b = box();
            if (!onPet || !b || (e.pointerType !== 'mouse' && !down)) {
                return;
            }
            stroked += Math.abs(e.movementX) + Math.abs(e.movementY);
            if (isPetStroke(stroked, b.width)) {
                stroked = 0;
                onPet();
            }
        };
        const unstroke = () => {
            stroked = 0;
        };

        const press = (e: PointerEvent) => {
            if (!tug || e.button !== 0) {
                return;
            }
            down = { x: e.clientX, y: e.clientY, id: e.pointerId };
            el.setPointerCapture(e.pointerId);
            el.style.transition = 'none';
            el.style.transformOrigin = '50% 100%';
        };
        const pull = (e: PointerEvent) => {
            if (!down || e.pointerId !== down.id) {
                return;
            }
            const size = box()?.width ?? 200;
            const pose = tugPose(
                e.clientX - down.x,
                e.clientY - down.y,
                size,
                reducedMotion(),
            );
            el.style.transform = `rotate(${pose.rotate}deg) scaleY(${pose.scaleY})`;
        };
        const release = (e: PointerEvent) => {
            if (!down || e.pointerId !== down.id) {
                return;
            }
            down = null;
            // Spring back with a small overshoot.
            el.style.transition =
                'transform 450ms cubic-bezier(0.34, 1.8, 0.64, 1)';
            el.style.transform = '';
            look({ x: 0, y: 0 });
            lean(0);
            stroked = 0;
            if (e.type === 'pointerup') {
                onTap?.();
            }
        };
        const key = (e: KeyboardEvent) => {
            const g = glanceFor(e.key);
            if (!g || reducedMotion()) {
                return;
            }
            e.preventDefault();
            look(g);
            window.clearTimeout(glance);
            glance = window.setTimeout(() => look({ x: 0, y: 0 }), 700);
        };

        zone.addEventListener('pointermove', follow);
        zone.addEventListener('pointerleave', rest);
        el.addEventListener('pointerdown', press);
        el.addEventListener('pointermove', pull);
        el.addEventListener('pointermove', stroke);
        el.addEventListener('pointerleave', unstroke);
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        keys.addEventListener('keydown', key);

        return () => {
            zone.removeEventListener('pointermove', follow);
            zone.removeEventListener('pointerleave', rest);
            el.removeEventListener('pointerdown', press);
            el.removeEventListener('pointermove', pull);
            el.removeEventListener('pointermove', stroke);
            el.removeEventListener('pointerleave', unstroke);
            el.removeEventListener('pointerup', release);
            el.removeEventListener('pointercancel', release);
            keys.removeEventListener('keydown', key);
            window.clearTimeout(glance);
        };
    }
}
