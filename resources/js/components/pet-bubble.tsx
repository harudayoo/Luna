import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The moonling's speech bubble (spec 2026-11-25-luna-moonling-life, slice 5): a short line by the sprite for a
 * few seconds. The live region is always on the page so screen readers read each new line; the pop-in is
 * CSS-only and skipped under reduced motion. Place it inside a `relative` box around the sprite.
 */
const PLACE = {
    // Centred above the sprite, or at the top of its box, in a lane the box keeps free (the panel and the Nest), so
    // it never covers an item.
    above: {
        box: 'bottom-full left-1/2 mb-1 -translate-x-1/2',
        tail: 'top-full left-1/2',
    },
    top: { box: 'top-0 left-1/2 -translate-x-1/2', tail: 'top-full left-1/2' },
    // The Home card: beside the sprite, inside the card, over its text for a moment. Above the card it would
    // be clipped (the dark card and the desktop rail both cut off what sticks out).
    card: { box: 'top-1 left-full ml-2', tail: 'top-4 left-0' },
} as const;

export function PetBubble({
    text,
    place = 'above',
    bottom,
}: {
    text: string | null;
    /** Where it sits in the `relative` box around the sprite. */
    place?: keyof typeof PLACE;
    /** With `top`: where its tail ends, in px from the box's top (just above the drawing; lib/pet-play bubbleBottom). */
    bottom?: number;
}) {
    return (
        <span
            role="status"
            className={`pointer-events-none absolute z-10 ${PLACE[place].box}`}
            style={
                bottom === undefined
                    ? undefined
                    : // Lifted by its tail, the light theme's offset shadow and room for its breathing and landing bounce.
                      {
                          top: bottom,
                          transform: 'translateY(calc(-100% - 14px))',
                      }
            }
        >
            {text && (
                <span
                    key={text}
                    className="relative block w-max max-w-48 bg-surface px-3 py-2 text-center text-sm leading-tight font-semibold text-ink shadow-lift motion-safe:transition motion-safe:duration-200 motion-safe:starting:scale-75 motion-safe:starting:opacity-0"
                >
                    {text}
                    <span
                        aria-hidden
                        className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-surface ${PLACE[place].tail}`}
                    />
                </span>
            )}
        </span>
    );
}

/** The current line and `say(line)`, which shows it for `ms` milliseconds (a new line replaces the old one). */
export function useBubble(ms = 4000): [string | null, (text: string) => void] {
    const [text, setText] = useState<string | null>(null);
    const timer = useRef(0);

    const say = useCallback(
        (line: string) => {
            window.clearTimeout(timer.current);
            setText(line);
            timer.current = window.setTimeout(() => setText(null), ms);
        },
        [ms],
    );

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return [text, say];
}
