import type { ReactNode } from 'react';

/**
 * A chart in a card: a title that names the series (single series, so no legend box), an optional
 * note, the chart, and its table view, so no value is reachable only by hovering.
 */
export function ChartCard({
    title,
    note,
    table,
    children,
}: {
    title: string;
    note?: string;
    /** Column headings, then rows of cells. */
    table: { head: string[]; rows: (string | number)[][] };
    children: ReactNode;
}) {
    return (
        <section className="ocs-card min-w-0">
            <h3 className="font-semibold">{title}</h3>
            {note && <p className="mt-1 text-sm text-muted">{note}</p>}
            <div className="mt-4">{children}</div>
            <details className="mt-4 text-sm">
                <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-primary">
                    Show as a table
                </summary>
                <div className="overflow-x-auto">
                    <table className="w-full text-left tabular-nums">
                        <thead>
                            <tr className="text-muted">
                                {table.head.map((h) => (
                                    <th
                                        key={h}
                                        className="py-1 pr-4 font-normal"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map((row, i) => (
                                <tr key={i}>
                                    {row.map((cell, j) => (
                                        <td key={j} className="py-1 pr-4">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </section>
    );
}
