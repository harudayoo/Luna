import { Link, usePage } from '@inertiajs/react';
import { Ellipsis } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { bloomTravel, ocsRef } from '@/lib/ocs';
import { DOCK_SLOTS, MODULES } from '@/modules';
import type { Module } from '@/modules';

const tile =
    'flex h-16 w-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted transition-colors duration-(--dur-fast) hover:bg-surface-hover hover:text-ink focus-visible:bg-surface-hover focus-visible:outline-none sm:w-20 aria-[current=page]:text-primary [&_svg]:size-5 [&_svg]:transition-transform motion-safe:hover:[&_svg]:-translate-y-0.5';

const press = ocsRef(['squish']);

/*
 * The Bloom dock: Luna's navigation on every screen size (it replaces the kit AppShell's
 * tabs/rail/sidebar, by the user's choice). A solid slab bottom-centre, lifted with the
 * kit's `lift` token (ink shadow by day, violet glow at night). A tiny orchid, for the Luna
 * orchid the app is named after, sits over the module you're in and travels when you move
 * (lib/ocs.ts bloomTravel).
 */
export function BloomDock() {
    const { auth } = usePage().props;
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const dock = useRef<HTMLDivElement>(null);
    const bloom = useRef<HTMLSpanElement>(null);
    const placed = useRef(false);

    const mine = MODULES.filter((m) => !m.gate || auth.can[m.gate]);
    const overflow = mine.length > DOCK_SLOTS;
    const shown = overflow ? mine.slice(0, DOCK_SLOTS - 1) : mine;
    const more = overflow ? mine.slice(DOCK_SLOTS - 1) : [];
    const here = mine.find((m) => isCurrentOrParentUrl(m.match));
    const activeKey = here ? (shown.includes(here) ? here.key : 'more') : null;

    useLayoutEffect(() => {
        const marker = bloom.current;
        const bar = dock.current;

        if (!marker || !bar) {
            return;
        }

        const place = (instant: boolean) => {
            const target = activeKey
                ? bar.querySelector<HTMLElement>(`[data-dock="${activeKey}"]`)
                : null;
            marker.style.opacity = target ? '1' : '0';

            if (target) {
                const x =
                    target.offsetLeft +
                    target.offsetWidth / 2 -
                    marker.offsetWidth / 2;
                bloomTravel(marker, x, instant);
            }
        };

        place(!placed.current);
        placed.current = true;

        const resize = new ResizeObserver(() => place(true));
        resize.observe(bar);

        return () => resize.disconnect();
    }, [activeKey]);

    return (
        <nav
            aria-label="Modules"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
            <div
                ref={dock}
                className="pointer-events-auto relative flex bg-surface shadow-lift"
            >
                <Bloom ref={bloom} />
                {shown.map((m) => (
                    <DockLink
                        key={m.key}
                        module={m}
                        current={m.key === activeKey}
                    />
                ))}
                {overflow && (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            data-dock="more"
                            className={tile}
                            aria-current={
                                activeKey === 'more' ? 'page' : undefined
                            }
                        >
                            <Ellipsis aria-hidden="true" />
                            More
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align="end"
                            sideOffset={12}
                            className="grid min-w-48 gap-1 p-2"
                        >
                            {more.map((m) => (
                                <DropdownMenuItem key={m.key} asChild>
                                    <Link
                                        href={m.href}
                                        className="flex min-h-10 items-center gap-3"
                                    >
                                        <m.icon aria-hidden="true" />
                                        {m.title}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </nav>
    );
}

function DockLink({
    module: m,
    current,
}: {
    module: Module;
    current: boolean;
}) {
    return (
        <Link
            ref={press}
            href={m.href}
            prefetch
            data-dock={m.key}
            aria-current={current ? 'page' : undefined}
            className={tile}
        >
            <m.icon aria-hidden="true" />
            {m.title}
        </Link>
    );
}

const PETALS = [0, 72, 144, 216, 288];

/**
 * A tiny five-petal orchid over the dock's top edge, above the current module.
 * Petals in `primary`, the centre in `accent`: tokens, so it switches with the theme.
 */
function Bloom({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
    return (
        <span
            ref={ref}
            aria-hidden="true"
            // z-10: tiles get their own layer (the kit's squish transforms them) and would
            // otherwise paint their hover shade over the petals that dip into the dock.
            className="pointer-events-none absolute -top-3 left-0 z-10 size-[18px] opacity-0 transition-opacity duration-(--dur-base) dark:drop-shadow-[0_0_6px_var(--accent)]"
        >
            <svg viewBox="-12 -12 24 24" className="size-full">
                {PETALS.map((deg) => (
                    <g key={deg} transform={`rotate(${deg})`}>
                        <ellipse
                            data-petal
                            cx="0"
                            cy="-5.4"
                            rx="3.4"
                            ry="5.6"
                            className="fill-primary"
                            style={{
                                transformBox: 'fill-box',
                                transformOrigin: '50% 100%',
                            }}
                        />
                    </g>
                ))}
                <circle r="2.6" className="fill-accent" />
            </svg>
        </span>
    );
}
