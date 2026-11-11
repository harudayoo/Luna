import { Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import AppLogo from '@/components/app-logo';
import { BloomDock } from '@/components/bloom-dock';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { dashboard } from '@/routes';

/*
 * Luna's page frame: a slim top bar (logo, page title, theme, account) and the content.
 * Navigation is the Bloom dock at the bottom (components/bloom-dock.tsx, modules.ts), on every
 * screen size; it replaces the kit AppShell's tabs/rail/sidebar by the user's choice.
 * The shell is solid; the background canvas lives once in app.tsx.
 */
export function AppShell({
    title,
    children,
}: {
    title?: string;
    children: ReactNode;
}) {
    const { auth } = usePage().props;

    return (
        <div className="min-h-dvh">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-surface px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href={dashboard()} prefetch aria-label="Luna home">
                        <AppLogo />
                    </Link>
                    {title && (
                        <h1 className="truncate text-sm font-semibold text-muted">
                            <span aria-hidden="true" className="mr-3">
                                ·
                            </span>
                            {title}
                        </h1>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="flex h-10 items-center gap-2 px-2 hover:bg-surface-hover"
                            aria-label="Account menu"
                        >
                            <UserInfo user={auth.user} compact />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <UserMenuContent user={auth.user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Bottom padding keeps the last content clear of the dock. */}
            <main className="min-w-0 p-4 pb-32 md:p-6 md:pb-32">
                <div className="mx-auto max-w-[1200px]">{children}</div>
            </main>

            <BloomDock />
        </div>
    );
}
