import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { bloomFan, bloomTravel, ocsRef } from '@/lib/ocs';
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
 *
 * Past DOCK_SLOTS modules (HR/admin), the middle slot becomes an orchid bud: tapping it blooms
 * the remaining modules out in an arc above the dock (lib/ocs.ts bloomFan).
 */
export function BloomDock() {
    const { auth, notifications } = usePage().props;
    const dots = notifications?.modules ?? {};
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const dock = useRef<HTMLDivElement>(null);
    const bloom = useRef<HTMLSpanElement>(null);
    const placed = useRef(false);

    const mine = MODULES.filter((m) => !m.gate || auth.can[m.gate]);
    const { left, fanned, right } = splitDock(mine);
    const here = mine.find((m) => isCurrentOrParentUrl(m.match));
    const activeKey = here ? (fanned.includes(here) ? 'bud' : here.key) : null;

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
                // offsetLeft of the bud is inside its wrapper; measure against the bar instead.
                const x =
                    target.getBoundingClientRect().left -
                    bar.getBoundingClientRect().left +
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
                {left.map((m) => (
                    <DockLink
                        key={m.key}
                        module={m}
                        current={m.key === activeKey}
                        unread={dots[m.key] ?? 0}
                    />
                ))}
                {fanned.length > 0 && (
                    <Bud
                        modules={fanned}
                        currentKey={activeKey === 'bud' ? here?.key : undefined}
                        dots={dots}
                    />
                )}
                {right.map((m) => (
                    <DockLink
                        key={m.key}
                        module={m}
                        current={m.key === activeKey}
                        unread={dots[m.key] ?? 0}
                    />
                ))}
            </div>
        </nav>
    );
}

/**
 * Up to DOCK_SLOTS modules: all in a row (`left`). Past that, the middle slot is the bud: the first
 * DOCK_SLOTS - 1 modules sit either side of it and the rest fan out of it, in MODULES order.
 */
export function splitDock<T>(mine: T[]): {
    left: T[];
    fanned: T[];
    right: T[];
} {
    if (mine.length <= DOCK_SLOTS) {
        return { left: mine, fanned: [], right: [] };
    }

    const direct = mine.slice(0, DOCK_SLOTS - 1);
    const half = Math.ceil(direct.length / 2);

    return {
        left: direct.slice(0, half),
        fanned: mine.slice(DOCK_SLOTS - 1),
        right: direct.slice(half),
    };
}

/** A tile's "something new here" mark: a small square in the accent, from the bell's unread notices. */
function NewDot() {
    return (
        <>
            <span
                aria-hidden="true"
                className="absolute top-2 right-3 size-2 bg-accent"
            />
            <span className="sr-only"> (new)</span>
        </>
    );
}

function DockLink({
    module: m,
    current,
    unread,
}: {
    module: Module;
    current: boolean;
    unread: number;
}) {
    return (
        <Link
            ref={press}
            href={m.href}
            prefetch
            data-dock={m.key}
            aria-current={current ? 'page' : undefined}
            className={`${tile} relative`}
        >
            <m.icon aria-hidden="true" />
            {m.title}
            {unread > 0 && <NewDot />}
        </Link>
    );
}

/*
 * Where each fanned tile sits, in px from the bud's centre. Rings of up to 4 tiles: neighbours stay
 * 84px apart (64px tiles + a gap), a ring never opens wider than +-50 degrees so its outer tiles clear
 * the dock (it grows its radius instead), and each ring sits 80px outside the last. Fits 360 wide.
 */
export function arc(n: number): { x: number; y: number }[] {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const rings = Math.ceil(n / 4);
    const spots: { x: number; y: number }[] = [];
    let radius = 24;

    for (let r = 0; r < rings; r++) {
        const m = Math.ceil((n - spots.length) / (rings - r));
        radius = Math.max(104, radius + 80);
        // Half the angle between neighbours, for an 84px chord.
        let step = (Math.asin(42 / radius) * 180) / Math.PI;

        if (m > 1 && (m - 1) * step > 50) {
            step = 50 / (m - 1);
            radius = 42 / Math.sin(rad(step));
        }

        for (let i = 0; i < m; i++) {
            const a = rad((i - (m - 1) / 2) * 2 * step);
            spots.push({
                x: Math.round(radius * Math.sin(a)),
                y: Math.round(-radius * Math.cos(a)),
            });
        }
    }

    return spots;
}

function Bud({
    modules,
    currentKey,
    dots,
}: {
    modules: Module[];
    currentKey?: string;
    dots: Record<string, number>;
}) {
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const fan = useRef<HTMLUListElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const first = useRef(true);
    const id = useId();
    const spots = arc(modules.length);

    useEffect(() => {
        if (!fan.current || !button.current) {
            return;
        }

        // First render: settle closed without animating.
        if (first.current) {
            first.current = false;

            if (!open) {
                fan.current.style.visibility = 'hidden';

                return;
            }
        }

        bloomFan(fan.current, button.current, open);

        if (open) {
            fan.current
                .querySelector<HTMLElement>('[data-fan-item]')
                ?.focus({ preventScroll: true });
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const outside = (e: PointerEvent) => {
            if (!wrap.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const stop = router.on('start', (e) => {
            if (closesFan(e.detail.visit)) {
                setOpen(false);
            }
        });
        document.addEventListener('pointerdown', outside);

        return () => {
            document.removeEventListener('pointerdown', outside);
            stop();
        };
    }, [open]);

    return (
        <div
            ref={wrap}
            className="relative"
            onKeyDown={(e) => {
                if (e.key === 'Escape' && open) {
                    e.stopPropagation();
                    setOpen(false);
                    button.current?.focus();
                }
            }}
            onBlur={(e) => {
                if (
                    open &&
                    e.relatedTarget &&
                    !wrap.current?.contains(e.relatedTarget as Node)
                ) {
                    setOpen(false);
                }
            }}
        >
            <ul
                ref={fan}
                id={id}
                role="menu"
                aria-label="More modules"
                className="pointer-events-auto absolute top-1/2 left-1/2 z-20"
            >
                {modules.map((m, i) => (
                    <li key={m.key} role="none">
                        <Link
                            href={m.href}
                            prefetch
                            role="menuitem"
                            data-fan-item
                            data-x={spots[i].x}
                            data-y={spots[i].y}
                            aria-current={
                                m.key === currentKey ? 'page' : undefined
                            }
                            onClick={() => setOpen(false)}
                            className="absolute -top-8 -left-8 flex size-16 flex-col items-center justify-center gap-1 bg-surface text-[11px] font-semibold text-muted opacity-0 shadow-lift hover:bg-surface-hover hover:text-ink focus-visible:bg-surface-hover focus-visible:text-ink focus-visible:outline-none aria-[current=page]:text-primary [&_svg]:size-5"
                        >
                            <m.icon aria-hidden="true" />
                            {m.title}
                            {(dots[m.key] ?? 0) > 0 && <NewDot />}
                        </Link>
                    </li>
                ))}
            </ul>
            <button
                ref={button}
                type="button"
                data-dock="bud"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={id}
                aria-current={currentKey ? 'page' : undefined}
                onClick={() => setOpen((o) => !o)}
                className={`${tile} relative ${open ? 'text-primary' : ''}`}
            >
                <OrchidGlyph budded />
                More
                {modules.some((m) => (dots[m.key] ?? 0) > 0) && <NewDot />}
            </button>
        </div>
    );
}

/**
 * Whether an Inertia "start" closes the fan. The tiles prefetch on hover and Inertia fires "start" for a
 * prefetch too, so only a real visit may close it (else hovering a tile shut the fan under the cursor).
 */
export function closesFan(visit: { prefetch: boolean }): boolean {
    return !visit.prefetch;
}

const PETALS = [0, 72, 144, 216, 288];

/**
 * The five-petal orchid. Petals in `primary`, the centre in `accent`: tokens, so it switches with
 * the theme. `budded`: the dock's middle bud, petals half-closed until the fan opens (bloomFan).
 */
function OrchidGlyph({ budded = false }: { budded?: boolean }) {
    return (
        <svg viewBox="-12 -12 24 24" className="size-full" aria-hidden="true">
            {PETALS.map((deg) => (
                <g key={deg} transform={`rotate(${deg})`}>
                    <ellipse
                        {...(budded
                            ? { 'data-bud-petal': '' }
                            : { 'data-petal': '' })}
                        cx="0"
                        cy="-5.4"
                        rx="3.4"
                        ry="5.6"
                        className="fill-primary"
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: '50% 100%',
                            transform: budded ? 'scale(0.55)' : undefined,
                        }}
                    />
                </g>
            ))}
            <circle r="2.6" className="fill-accent" />
        </svg>
    );
}

/** A tiny orchid over the dock's top edge, above the current module. */
function Bloom({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
    return (
        <span
            ref={ref}
            aria-hidden="true"
            // z-10: tiles get their own layer (the kit's squish transforms them) and would
            // otherwise paint their hover shade over the petals that dip into the dock.
            className="pointer-events-none absolute -top-3 left-0 z-10 size-[18px] opacity-0 transition-opacity duration-(--dur-base) dark:drop-shadow-[0_0_6px_var(--accent)]"
        >
            <OrchidGlyph />
        </span>
    );
}
