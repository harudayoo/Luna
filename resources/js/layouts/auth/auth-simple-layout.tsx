import { useEffect, useRef } from 'react';
import { AppLogoMark } from '@/components/app-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { brandPanelLand } from '@/lib/ocs';
import type { AuthLayoutProps } from '@/types';

/** Rows of the panel's LUNA wallpaper; plenty, the panel crops what doesn't fit. */
const ROWS = 14;

/**
 * Sign-in pages (user's pick, 2026-11-12, "wallpaper + badge"): a split screen. The form sits on the
 * page on one side; the other is a solid accent panel tiled with a faint LUNA wallpaper (Bungee) and a
 * badge in the middle with the OCS logo and LUNA. Phone first: the panel is a short header above the
 * form; from md it takes the right half. It lands once on load (brandPanelLand, lib/ocs.ts).
 */
export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (panel.current) {
            brandPanelLand(panel.current);
        }
    }, []);

    return (
        <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-[1.4fr_1fr] md:grid-rows-1">
            {/*
             * The brand panel: decorative, the badge carries the name for screen readers. About 40% wide
             * from md. By day a teal panel; at night (user, 2026-11-12: the orchid panel lit up the room)
             * the deep surface colour with the wallpaper as a faint orchid glow, so only the badge is bright.
             */}
            <div
                ref={panel}
                className="relative flex h-48 items-center justify-center overflow-hidden bg-accent sm:h-56 md:order-2 md:h-auto dark:bg-surface"
            >
                <div
                    className="absolute -inset-x-8 -inset-y-4 flex flex-col font-brand text-[3.5rem] leading-[0.9] whitespace-nowrap text-bg opacity-15 select-none md:text-[5.5rem] dark:text-accent dark:opacity-[0.07]"
                    aria-hidden="true"
                >
                    {Array.from({ length: ROWS }, (_, i) => (
                        <span
                            key={i}
                            data-row
                            // Every other row shifts half a word, like bricks.
                            className={i % 2 ? '-ml-[1.6em]' : ''}
                        >
                            {'LUNA'.repeat(12)}
                        </span>
                    ))}
                </div>
                <div
                    data-badge
                    className="relative flex items-center gap-3 bg-bg px-5 py-3 shadow-lift md:gap-5 md:px-8 md:py-5"
                    role="img"
                    aria-label="Luna, by Orchid City Software"
                >
                    <AppLogoMark className="size-11 md:size-16" />
                    <span
                        className="pt-1 font-brand text-5xl leading-none text-accent md:text-7xl"
                        aria-hidden="true"
                    >
                        LUNA
                    </span>
                </div>
                {/* Theme toggle rides the panel's corner (on the page's surface colour, so it shows). */}
                <div className="absolute top-3 right-3 md:top-4 md:right-4">
                    <ThemeToggle />
                </div>
            </div>

            <div className="flex items-start justify-center px-5 py-8 sm:px-10 md:items-center md:py-10">
                <div className="w-full max-w-sm">
                    <h1 className="mb-1 text-xl font-semibold">{title}</h1>
                    <p className="mb-6 text-sm text-muted">{description}</p>
                    {children}
                </div>
            </div>
        </div>
    );
}
