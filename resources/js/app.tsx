import { createInertiaApp } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { ocs } from '@/lib/ocs';

const appName = import.meta.env.VITE_APP_NAME || 'Luna';

/*
 * The kit's live background. It adds window listeners it can't remove, so it is started
 * once per canvas and lives for the whole session (it sits above every layout).
 */
const started = new WeakSet<HTMLCanvasElement>();

function Background() {
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

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                <Background />
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: 'var(--primary)',
    },
});
