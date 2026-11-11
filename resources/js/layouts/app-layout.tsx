import { AppShell } from '@/components/app-shell';
import type { BreadcrumbItem } from '@/types';

/** Pages set `Page.layout = { breadcrumbs }`; the last crumb is the title in the top bar. */
export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    return <AppShell title={breadcrumbs.at(-1)?.title}>{children}</AppShell>;
}
