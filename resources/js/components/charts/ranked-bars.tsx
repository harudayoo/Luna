/**
 * A ranked list of horizontal bars, largest first, one hue (`primary`): a name, a bar and its
 * figure per row. The figures are printed, so nothing needs a tooltip. The bar drops under the
 * name on phones.
 */
export function RankedBars({
    rows,
    label,
}: {
    rows: {
        key: string | number;
        name: string;
        value: number;
        display: string;
    }[];
    label: string;
}) {
    const max = Math.max(...rows.map((r) => r.value), 0) || 1;

    return (
        <ul aria-label={label} className="grid gap-3">
            {rows.map((r) => (
                <li
                    key={r.key}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_1fr_4rem]"
                >
                    <span className="truncate text-sm">{r.name}</span>
                    <span className="text-right text-sm font-semibold tabular-nums sm:order-last">
                        {r.display}
                    </span>
                    <span
                        className="col-span-2 h-3 bg-surface-hover sm:col-span-1"
                        aria-hidden="true"
                    >
                        <span
                            className="block h-full max-h-6 bg-primary"
                            style={{ width: `${(r.value / max) * 100}%` }}
                        />
                    </span>
                </li>
            ))}
        </ul>
    );
}
