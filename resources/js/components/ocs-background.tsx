import { useEffect, useRef } from 'react';
import { ocs } from '@/lib/ocs';

/*
 * The kit's live background. It adds window listeners it can't remove, so it is started
 * once per canvas and lives for the whole session (it sits above every layout).
 *
 * It lives here, not in app.tsx, so app.tsx defines no component: a component there makes
 * @vitejs/plugin-react add a refresh footer that imports app.tsx again, and after an edit
 * under the dev server that second import (app.tsx?t=…) booted the whole app twice.
 */
const started = new WeakSet<HTMLCanvasElement>();

export function OcsBackground() {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const el = canvas.current;

        if (el && !started.has(el)) {
            started.add(el);
            ocs().background(el);
        }
    }, []);

    return <canvas ref={canvas} className="ocs-bg" aria-hidden="true" />;
}
