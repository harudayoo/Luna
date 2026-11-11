import AppLogo from '@/components/app-logo';
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
            <div className="fixed top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="ocs-card w-full max-w-sm">
                <div className="mb-4">
                    <AppLogo />
                </div>
                <h1 className="mb-1 text-xl font-semibold">{title}</h1>
                <p className="mb-6 text-sm text-muted">{description}</p>
                {children}
            </div>
        </div>
    );
}
