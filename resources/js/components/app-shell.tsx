import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import AppLogo from '@/components/app-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard } from '@/routes';
import { edit as editProfile } from '@/routes/profile';
import type { NavItem } from '@/types';

/** Main navigation. Phones show the first 4 as bottom tabs. `match` = the URL prefix it owns. */
const NAV: (NavItem & { match: string })[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        match: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Settings',
        href: editProfile(),
        match: '/settings',
        icon: Settings,
    },
];

const navItem =
    'flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-muted hover:bg-surface-hover aria-[current=page]:bg-primary aria-[current=page]:text-on-primary';

/*
 * The kit's AppShell (resources/ocs/guides/AppShell.md):
 *   < md   top bar, content, bottom tabs
 *   md-lg  top bar, 56px icon rail
 *   >= lg  top bar, 220px labeled sidebar
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
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const current = (item: (typeof NAV)[number]) =>
        isCurrentOrParentUrl(item.match) ? 'page' : undefined;

    return (
        <div className="grid min-h-dvh grid-rows-[56px_1fr_auto] md:grid-cols-[56px_1fr] md:grid-rows-[56px_1fr] lg:grid-cols-[220px_1fr]">
            <header className="flex items-center justify-between gap-4 bg-surface px-4 md:col-span-2">
                <div className="flex min-w-0 items-center gap-4">
                    <Link href={dashboard()} prefetch>
                        <AppLogo />
                    </Link>
                    {title && (
                        <h1 className="truncate text-sm font-semibold text-muted">
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

            <nav className="hidden bg-surface md:block" aria-label="Main">
                {NAV.map((item) => (
                    <Link
                        key={item.title}
                        href={item.href}
                        prefetch
                        aria-current={current(item)}
                        className={navItem}
                        title={item.title}
                    >
                        {item.icon && <item.icon className="size-4 shrink-0" />}
                        <span className="hidden lg:inline">{item.title}</span>
                    </Link>
                ))}
            </nav>

            <main className="min-w-0 p-4 md:p-6">
                <div className="mx-auto max-w-[1200px]">{children}</div>
            </main>

            <nav className="ocs-shell-nav md:hidden" aria-label="Main">
                {NAV.slice(0, 4).map((item) => (
                    <Link
                        key={item.title}
                        href={item.href}
                        aria-current={current(item)}
                    >
                        {item.title}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
