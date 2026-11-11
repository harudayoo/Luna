import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            [key: string]: unknown;
        };
    }
}

/** Orchid City kit globals (resources/ocs/ocs.js, loaded by lib/ocs.ts). */
declare global {
    interface Window {
        anime: unknown;
        OrchidCity: {
            init(scope?: ParentNode): void;
            magnetic(el: HTMLElement, opts?: { strength?: number }): void;
            wave(el: HTMLElement): void;
            decode(el: HTMLElement): void;
            squish(el: HTMLElement): void;
            tilt(el: HTMLElement): void;
            expand(
                card: HTMLElement,
                opts: { render: (panel: HTMLElement) => void },
            ): void;
            themeToggle(btn: HTMLElement): void;
            setTheme(theme: 'light' | 'dark'): void;
            initialTheme(): 'light' | 'dark';
            background(canvas: HTMLCanvasElement): {
                redraw(): void;
                stop(): void;
            };
            reduced(): boolean;
            isDark(): boolean;
        };
    }
}
