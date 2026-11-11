import { useState } from 'react';

export type Column = {
    key: string;
    /** Under the column (keep it short). */
    tick: string;
    /** Shorter tick for phones; defaults to `tick`. */
    tickShort?: string;
    /** Tooltip heading, e.g. "Oct 1–15". */
    title: string;
    value: number;
    /** Formatted value for the tooltip and labels. */
    display: string;
    /** Printed at the bar end: use sparingly (the peak, a shortfall). */
    label?: string;
};

const PLOT = 160; // px of bars
/** Room above the top and below the bottom value for end labels, so they never touch the axis. */
const PAD = 20;

/**
 * One series of columns from a zero baseline (values may go below it). Kit rules: square marks,
 * tokens only, hairline solid grid. Marks are `primary`; text stays in text tokens. Each column's
 * whole slot is the hover/focus target and shows the value; the card's table view repeats them all.
 */
export function ColumnChart({
    columns,
    format,
    label,
}: {
    columns: Column[];
    /** Axis tick format. */
    format: (n: number) => string;
    /** Accessible name for the chart. */
    label: string;
}) {
    const [active, setActive] = useState<number | null>(null);
    const values = columns.map((c) => c.value);
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const range = max - min || 1;
    const zero = PAD + (max / range) * PLOT;
    const y = (v: number) => zero - (v / range) * PLOT;
    const ticks = [max, 0, ...(min < 0 ? [min] : [])].filter(
        (t, i, a) => a.indexOf(t) === i,
    );
    const shown = active === null ? null : columns[active];

    return (
        <div role="group" aria-label={label} className="relative">
            <div className="flex gap-2">
                {/* Y axis: the top, zero and (if any) bottom values. */}
                <div
                    className="relative w-10 shrink-0 text-right text-xs text-muted tabular-nums"
                    style={{ height: PLOT + 2 * PAD }}
                    aria-hidden="true"
                >
                    {ticks.map((t) => (
                        <span
                            key={t}
                            className="absolute right-0 -translate-y-1/2"
                            style={{ top: y(t) }}
                        >
                            {format(t)}
                        </span>
                    ))}
                </div>

                <div className="relative min-w-0 flex-1">
                    <div
                        className="relative"
                        style={{ height: PLOT + 2 * PAD }}
                    >
                        {ticks.map((t) => (
                            <div
                                key={t}
                                className="absolute inset-x-0 h-px bg-surface-hover"
                                style={{ top: y(t) }}
                                aria-hidden="true"
                            />
                        ))}
                        <div className="absolute inset-0 flex">
                            {columns.map((c, i) => {
                                const top = c.value >= 0 ? y(c.value) : zero;
                                const height =
                                    (Math.abs(c.value) / range) * PLOT;

                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        className="group relative h-full min-w-0 flex-1 focus-visible:bg-surface-hover"
                                        aria-label={`${c.title}: ${c.display}`}
                                        onPointerEnter={() => setActive(i)}
                                        onPointerLeave={() => setActive(null)}
                                        onFocus={() => setActive(i)}
                                        onBlur={() => setActive(null)}
                                    >
                                        <span
                                            className={`absolute left-1/2 w-[70%] max-w-6 -translate-x-1/2 bg-primary ${
                                                active === i ? 'opacity-80' : ''
                                            }`}
                                            style={{
                                                top,
                                                height: Math.max(
                                                    height,
                                                    c.value === 0 ? 0 : 2,
                                                ),
                                            }}
                                        />
                                        {c.label && (
                                            <span
                                                className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-ink"
                                                style={
                                                    c.value >= 0
                                                        ? { top: top - 18 }
                                                        : {
                                                              top:
                                                                  top +
                                                                  height +
                                                                  2,
                                                          }
                                                }
                                            >
                                                {c.label}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* X axis */}
                    <div
                        className="mt-1 flex text-xs text-muted"
                        aria-hidden="true"
                    >
                        {columns.map((c) => (
                            <span
                                key={c.key}
                                className="min-w-0 flex-1 truncate text-center"
                            >
                                <span className="sm:hidden">
                                    {c.tickShort ?? c.tick}
                                </span>
                                <span className="hidden sm:inline">
                                    {c.tick}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tooltip: value first, then what it is. Text from data goes in as text, never HTML. */}
            {shown && (
                <div
                    className="pointer-events-none absolute -top-2 right-0 bg-bg px-3 py-2 text-sm shadow-lift"
                    role="status"
                >
                    <p className="font-semibold text-ink">{shown.display}</p>
                    <p className="text-xs text-muted">{shown.title}</p>
                </div>
            )}
        </div>
    );
}
