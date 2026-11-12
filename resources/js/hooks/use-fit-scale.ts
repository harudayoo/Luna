import { useEffect, useRef, useState } from 'react';

/**
 * Shrinks a true-size print preview to fit its stage (printing always uses the real size). Measures the
 * stage, not the window: on phones an overflowing sheet makes the browser zoom out, which would
 * inflate window.innerWidth and keep the preview at full size.
 */
export function useFitScale(widthIn: number) {
    const stage = useRef<HTMLElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const el = stage.current;
        if (!el) {
            return;
        }
        const fit = () => {
            const style = getComputedStyle(el);
            const inner =
                el.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight);
            setScale(Math.min(1, inner / (widthIn * 96)));
        };
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        fit();

        return () => observer.disconnect();
    }, [widthIn]);

    return [stage, scale] as const;
}
