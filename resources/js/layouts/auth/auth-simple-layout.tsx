import { AppLogoMark } from '@/components/app-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AuthLayoutProps } from '@/types';

/** Sign-in pages: one solid card on the page, background canvas behind (app.tsx). */
export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center p-4 sm:p-10">
            {/* Phones: in the flow above the card so it never covers it; corner from sm up. */}
            <div className="mb-3 flex w-full max-w-sm justify-end sm:fixed sm:top-4 sm:right-4 sm:mb-0 sm:w-auto">
                <ThemeToggle />
            </div>
            <div className="ocs-card w-full max-w-sm">
                {/* Brand lockup: Luna is the system's name, so it leads the card. Phone first, larger from sm. */}
                <div className="mb-8 flex items-center gap-3 sm:gap-4">
                    <AppLogoMark className="size-11 sm:size-14" />
                    <div className="min-w-0">
                        <p className="text-2xl leading-none font-bold tracking-tight text-accent sm:text-3xl">
                            Luna
                        </p>
                    </div>
                </div>
                <h1 className="mb-1 text-xl font-semibold">{title}</h1>
                <p className="mb-6 text-sm text-muted">{description}</p>
                {children}
            </div>
        </div>
    );
}
