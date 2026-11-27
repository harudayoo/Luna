import { describe, expect, it } from 'vitest';

import {
    blinkPlan,
    fidgetFor,
    GAZE_RADIUS,
    gazeOffset,
    glanceFor,
    isPetStroke,
    leanFor,
    tugPose,
} from '../../resources/js/lib/pet-play';

const box = { left: 100, top: 100, width: 200, height: 200 }; // centre (200, 200)

describe('gazeOffset', () => {
    it('looks straight ahead when the pointer is on the centre', () => {
        expect(gazeOffset(200, 200, box)).toEqual({ x: 0, y: 0 });
    });

    it('looks toward the pointer, never further than its radius', () => {
        expect(gazeOffset(1000, 200, box)).toEqual({ x: GAZE_RADIUS, y: 0 });
        expect(gazeOffset(200, -500, box)).toEqual({ x: 0, y: -GAZE_RADIUS });
        const far = gazeOffset(900, 900, box);
        expect(Math.hypot(far.x, far.y)).toBeCloseTo(GAZE_RADIUS);
        expect(far.x).toBeCloseTo(far.y);
    });

    it('moves less when the pointer is close', () => {
        const near = gazeOffset(220, 200, box);
        expect(near.x).toBeGreaterThan(0);
        expect(near.x).toBeLessThan(GAZE_RADIUS);
    });

    it('stays still under reduced motion', () => {
        expect(gazeOffset(1000, 1000, box, true)).toEqual({ x: 0, y: 0 });
    });
});

describe('tugPose', () => {
    it('stands straight with no pull', () => {
        expect(tugPose(0, 0, 200)).toEqual({ rotate: 0, scaleY: 1 });
    });

    it('leans toward the pull and stretches, both capped', () => {
        const right = tugPose(1000, 0, 200);
        expect(right).toEqual({ rotate: 12, scaleY: 1.15 });
        expect(tugPose(-1000, 0, 200).rotate).toBe(-12);
        const small = tugPose(20, 0, 200);
        expect(small.rotate).toBeGreaterThan(0);
        expect(small.rotate).toBeLessThan(12);
        expect(small.scaleY).toBeGreaterThan(1);
        expect(small.scaleY).toBeLessThan(1.15);
    });

    it('stays still under reduced motion', () => {
        expect(tugPose(1000, 500, 200, true)).toEqual({ rotate: 0, scaleY: 1 });
    });
});

describe('glanceFor', () => {
    it('maps the arrow keys to a glance that way, and nothing else', () => {
        expect(glanceFor('ArrowLeft')).toEqual({ x: -GAZE_RADIUS, y: 0 });
        expect(glanceFor('ArrowRight')).toEqual({ x: GAZE_RADIUS, y: 0 });
        expect(glanceFor('ArrowUp')).toEqual({ x: 0, y: -GAZE_RADIUS });
        expect(glanceFor('ArrowDown')).toEqual({ x: 0, y: GAZE_RADIUS });
        expect(glanceFor('Enter')).toBeNull();
        expect(glanceFor('a')).toBeNull();
    });
});

describe('blinkPlan', () => {
    it('waits a random 1.8 to 5.2 seconds, and a quarter of the blinks are double', () => {
        expect(blinkPlan(0, 0.9)).toEqual({ delay: 1800, double: false });
        expect(blinkPlan(1, 0.9)).toEqual({ delay: 5200, double: false });
        expect(blinkPlan(0.5, 0.1)).toEqual({ delay: 3500, double: true });
        expect(blinkPlan(0.5, 0.25).double).toBe(false);
    });
});

describe('fidgetFor', () => {
    const all = { arms: true, gaze: true };

    it('picks one of four fidgets from the roll', () => {
        expect([0, 0.3, 0.6, 0.9].map((r) => fidgetFor(r, all))).toEqual([
            'look',
            'wave',
            'hop',
            'wiggle',
        ]);
    });

    it('never waves without arms or looks around without eyes (the egg only wiggles)', () => {
        expect(fidgetFor(0.3, { arms: false, gaze: true })).not.toBe('wave');
        expect(
            [0, 0.3, 0.6, 0.9].map((r) =>
                fidgetFor(r, { arms: false, gaze: false }),
            ),
        ).toEqual(['wiggle', 'wiggle', 'wiggle', 'wiggle']);
    });
});

describe('leanFor', () => {
    it('leans toward the pointer, at most 5 degrees either way', () => {
        expect(leanFor(0, 200)).toBe(0);
        expect(leanFor(50, 200)).toBeGreaterThan(0);
        expect(leanFor(50, 200)).toBeLessThan(5);
        expect(leanFor(5000, 200)).toBe(5);
        expect(leanFor(-5000, 200)).toBe(-5);
    });

    it('stays upright under reduced motion', () => {
        expect(leanFor(5000, 200, true)).toBe(0);
    });
});

describe('isPetStroke', () => {
    it('counts as petting once the pointer has travelled over twice the sprite width', () => {
        expect(isPetStroke(399, 200)).toBe(false);
        expect(isPetStroke(401, 200)).toBe(true);
    });
});
