import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowUpRight,
    CalendarDays,
    CalendarRange,
    ChartColumn,
    ReceiptText,
} from 'lucide-react';
import { ocsRef } from '@/lib/ocs';

export type GlanceItem = {
    key: string;
    eyebrow: string;
    /** The gist: a number or a state, read in one look. */
    title: string;
    note: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
};

export const GLANCE_ICONS = {
    leave: CalendarDays,
    calendar: CalendarRange,
    analytics: ChartColumn,
    pay: ReceiptText,
} as const;

const press = ocsRef(['squish']);

/*
 * Home's "at a glance" items, drawn two ways from one list (dashboard.tsx):
 *   GlanceStrip: phones and tablets, a swipeable row of chips right under the greeting (gist first).
 *   GlanceRail:  lg+, a stacked rail beside Time and WIP, so nothing waits below the fold.
 * Each item is one link; the icon peeks oversized from the corner and lifts on hover.
 */
export function GlanceStrip({ items }: { items: GlanceItem[] }) {
    return (
        <nav
            aria-label="At a glance"
            className="mb-6 flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:gap-3 lg:hidden [&::-webkit-scrollbar]:hidden"
        >
            {items.map((item) => (
                <Link
                    key={item.key}
                    ref={press}
                    href={item.href}
                    prefetch
                    className="ocs-card ocs-card-link group relative flex min-h-24 w-[9.5rem] shrink-0 snap-start flex-col justify-between gap-2 p-3! md:flex-1 md:p-4!"
                >
                    <Peek icon={item.icon} />
                    <span className="ocs-eyebrow mb-0">{item.eyebrow}</span>
                    <span>
                        <span className="block text-base leading-5 font-semibold">
                            {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                            {item.note}
                        </span>
                    </span>
                </Link>
            ))}
        </nav>
    );
}

export function GlanceRail({ items }: { items: GlanceItem[] }) {
    return (
        <nav
            aria-label="At a glance"
            className="sticky top-20 hidden flex-col gap-3 lg:flex"
        >
            <p className="ocs-eyebrow mb-0">At a glance</p>
            {items.map((item) => (
                <Link
                    key={item.key}
                    ref={press}
                    href={item.href}
                    prefetch
                    className="ocs-card ocs-card-link group relative block p-5!"
                >
                    <Peek icon={item.icon} />
                    <span className="flex items-center justify-between gap-2">
                        <span className="ocs-eyebrow mb-0">{item.eyebrow}</span>
                        <ArrowUpRight
                            aria-hidden
                            className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none"
                        />
                    </span>
                    <span className="mt-1 block text-lg leading-6 font-semibold">
                        {item.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                        {item.note}
                    </span>
                </Link>
            ))}
        </nav>
    );
}

/** The item's icon, oversized and faint in the bottom-right corner; it rises and tilts on hover. */
function Peek({ icon: Icon }: { icon: LucideIcon }) {
    return (
        // Its own clipping box: the kit lets light-theme cards overflow (for the press shadow).
        <span
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <Icon
                strokeWidth={1.5}
                className="absolute -right-3 -bottom-4 size-16 -rotate-8 text-primary opacity-10 transition-transform duration-(--dur-base) group-hover:-translate-y-1 group-hover:rotate-0 motion-reduce:transition-none"
            />
        </span>
    );
}
