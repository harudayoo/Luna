import { Head, router } from '@inertiajs/react';
import { ChartCard } from '@/components/charts/chart-card';
import { ColumnChart } from '@/components/charts/column-chart';
import { RankedBars } from '@/components/charts/ranked-bars';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as analyticsIndex } from '@/routes/analytics';

type MyCutOff = {
    start: string;
    end: string;
    balance: number;
    taken_hours: number;
    deducted_hours: number;
    deducted_pesos: number | null;
};

type Office = {
    months: { month: string; days: number }[];
    weekdays: { day: string; days: number }[];
    people: {
        id: number;
        name: string;
        days: number;
        deducted_hours: number;
        deducted_pesos: number | null;
        has_rate: boolean;
    }[];
    cutoffs: {
        start: string;
        end: string;
        deducted_hours: number;
        deducted_pesos: number;
        people: number;
    }[];
    totals: {
        deducted_hours: number;
        deducted_pesos: number;
        missing_rate: number;
    };
    upcoming: {
        id: number;
        name: string;
        dates: { date: string; days: number }[];
        days: number;
    }[];
};

type Props = {
    year: number;
    years: number[];
    me: {
        balance_hours: number;
        hours_per_day: number;
        taken_days: number;
        unpaid_hours: number;
        unpaid_pesos: number | null;
        cutoffs: MyCutOff[];
    };
    office?: Office;
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const short = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const day = (iso: string) =>
    fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const hours = (h: number) => `${h.toFixed(2)} h`;
const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`;
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
const range = (c: { start: string; end: string }) =>
    `${short(c.start)}–${short(c.end)}`;

/** Your PTO over the year, and for HR the office's leave, payroll deductions and who's away soon. */
export default function Analytics({ year, years, me, office }: Props) {
    const peak = Math.max(...me.cutoffs.map((c) => c.balance), 0);
    const worst = Math.min(...me.cutoffs.map((c) => c.balance), 0);

    return (
        <>
            <Head title="Analytics" />
            <p className="ocs-eyebrow">Analytics</p>
            <h2 className="mb-4 text-2xl font-semibold">Leave and pay</h2>

            {/* One filter row, above everything it scopes. */}
            <div className="mb-6 flex items-center gap-3">
                <label htmlFor="year" className="text-sm text-muted">
                    Year
                </label>
                <Select
                    value={String(year)}
                    onValueChange={(y) =>
                        router.get(
                            analyticsIndex({ query: { year: y } }).url,
                            {},
                            { preserveScroll: true },
                        )
                    }
                >
                    <SelectTrigger id="year" className="w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <h3 className="ocs-eyebrow mb-3">My PTO</h3>
            <div className="ocs-grid mb-4">
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Balance now</p>
                    <p className="text-3xl font-semibold text-ink">
                        {hours(me.balance_hours)}
                    </p>
                    <p className="mt-1">
                        {(me.balance_hours / me.hours_per_day).toFixed(2)} days
                    </p>
                </section>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Leave in {year}</p>
                    <p className="text-3xl font-semibold text-ink">
                        {days(me.taken_days)}
                    </p>
                    <p className="mt-1">Including leave already planned</p>
                </section>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Unpaid in {year}</p>
                    <p
                        className={`text-3xl font-semibold ${me.unpaid_hours > 0 ? 'text-danger' : 'text-ink'}`}
                    >
                        {me.unpaid_hours > 0 ? '−' : ''}
                        {hours(me.unpaid_hours)}
                    </p>
                    <p className="mt-1">
                        {me.unpaid_hours === 0
                            ? 'No deductions'
                            : me.unpaid_pesos !== null
                              ? `${peso(me.unpaid_pesos)} deducted from pay`
                              : 'Deducted from pay (no daily rate set)'}
                    </p>
                </section>
            </div>

            {me.cutoffs.length > 0 && (
                <ChartCard
                    title="PTO balance by cut-off"
                    note="At the end of each cut-off. Below zero is unpaid and comes off that payroll."
                    table={{
                        head: ['Cut-off', 'Took', 'Balance', 'Unpaid'],
                        rows: me.cutoffs.map((c) => [
                            range(c),
                            hours(c.taken_hours),
                            hours(c.balance),
                            c.deducted_hours > 0
                                ? `${hours(c.deducted_hours)}${c.deducted_pesos !== null ? ` · ${peso(c.deducted_pesos)}` : ''}`
                                : '–',
                        ]),
                    }}
                >
                    <ColumnChart
                        label="PTO balance at the end of each cut-off"
                        format={(n) => `${Math.round(n)} h`}
                        columns={me.cutoffs.map((c) => ({
                            key: c.start,
                            tick: short(c.start),
                            // Phones: month initial + day ("S16"), so each cut-off is unambiguous.
                            tickShort: `${fmt(c.start, { month: 'narrow' })}${fmt(c.start, { day: 'numeric' })}`,
                            title: range(c),
                            value: c.balance,
                            display:
                                c.balance < 0
                                    ? `${hours(-c.balance)} unpaid`
                                    : `${hours(c.balance)} left`,
                            // Label only the extremes (worst shortfall, high point); the tooltip and table carry the rest.
                            label:
                                c.balance === worst && worst < 0
                                    ? `−${(-c.balance).toFixed(1)} unpaid`
                                    : c.balance === peak && peak > 0
                                      ? c.balance.toFixed(1)
                                      : undefined,
                        }))}
                    />
                </ChartCard>
            )}

            {office && <OfficeViews year={year} office={office} />}
        </>
    );
}

function OfficeViews({ year, office }: { year: number; office: Office }) {
    const busiest = Math.max(...office.months.map((m) => m.days));

    return (
        <>
            <h3 className="ocs-eyebrow mt-10 mb-3">Office leave · {year}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                    title="Leave days per month"
                    note="Everyone’s leave. Holidays never count."
                    table={{
                        head: ['Month', 'Days'],
                        rows: office.months.map((m) => [
                            fmt(`${m.month}-01`, { month: 'long' }),
                            m.days,
                        ]),
                    }}
                >
                    <ColumnChart
                        label="Leave days per month"
                        format={(n) => String(Math.round(n))}
                        columns={office.months.map((m) => ({
                            key: m.month,
                            tick: fmt(`${m.month}-01`, { month: 'short' }),
                            tickShort: fmt(`${m.month}-01`, {
                                month: 'narrow',
                            }),
                            title: fmt(`${m.month}-01`, {
                                month: 'long',
                                year: 'numeric',
                            }),
                            value: m.days,
                            display: days(m.days),
                            label:
                                m.days === busiest && busiest > 0
                                    ? String(m.days)
                                    : undefined,
                        }))}
                    />
                </ChartCard>

                <ChartCard
                    title="Leave by weekday"
                    note="Which days people take off most."
                    table={{
                        head: ['Weekday', 'Days'],
                        rows: office.weekdays.map((w) => [w.day, w.days]),
                    }}
                >
                    <ColumnChart
                        label="Leave days by weekday"
                        format={(n) => String(Math.round(n))}
                        columns={office.weekdays.map((w) => ({
                            key: w.day,
                            tick: w.day,
                            title: w.day,
                            value: w.days,
                            display: days(w.days),
                        }))}
                    />
                </ChartCard>

                <ChartCard
                    title="Leave days per person"
                    note="Most first."
                    table={{
                        head: ['Person', 'Days'],
                        rows: office.people.map((p) => [p.name, p.days]),
                    }}
                >
                    <RankedBars
                        label="Leave days per person"
                        rows={office.people.map((p) => ({
                            key: p.id,
                            name: p.name,
                            value: p.days,
                            display: String(p.days),
                        }))}
                    />
                </ChartCard>

                <UpcomingAbsences upcoming={office.upcoming} />
            </div>

            <h3 className="ocs-eyebrow mt-10 mb-3">
                Payroll deductions · {year}
            </h3>
            <div className="ocs-grid mb-4">
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Unpaid in {year}</p>
                    <p
                        className={`text-3xl font-semibold ${office.totals.deducted_hours > 0 ? 'text-danger' : 'text-ink'}`}
                    >
                        {peso(office.totals.deducted_pesos)}
                    </p>
                    <p className="mt-1">
                        {hours(office.totals.deducted_hours)} unpaid
                        {office.totals.missing_rate > 0 &&
                            ` · ${office.totals.missing_rate} without a daily rate, not counted`}
                    </p>
                </section>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <DeductionTable
                    title="By cut-off"
                    head={['Cut-off', 'People', 'Hours', 'Pesos']}
                    empty="No unpaid leave this year."
                    rows={office.cutoffs.map((c) => [
                        range(c),
                        String(c.people),
                        hours(c.deducted_hours),
                        peso(c.deducted_pesos),
                    ])}
                    total={[
                        'Total',
                        '',
                        hours(office.totals.deducted_hours),
                        peso(office.totals.deducted_pesos),
                    ]}
                />
                <DeductionTable
                    title="By person"
                    head={['Person', 'Hours', 'Pesos']}
                    empty="No unpaid leave this year."
                    rows={office.people
                        .filter((p) => p.deducted_hours > 0)
                        .map((p) => [
                            p.name,
                            hours(p.deducted_hours),
                            p.deducted_pesos !== null
                                ? peso(p.deducted_pesos)
                                : 'No daily rate',
                        ])}
                    total={[
                        'Total',
                        hours(office.totals.deducted_hours),
                        peso(office.totals.deducted_pesos),
                    ]}
                />
            </div>
        </>
    );
}

function UpcomingAbsences({ upcoming }: { upcoming: Office['upcoming'] }) {
    return (
        <section className="ocs-card min-w-0">
            <h3 className="font-semibold">Next 30 days</h3>
            <p className="mt-1 text-sm text-muted">
                Who&rsquo;s away soon, to plan cover.
            </p>
            {upcoming.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                    Nobody has leave planned.
                </p>
            ) : (
                <ul className="mt-4 grid gap-2">
                    {upcoming.map((p) => (
                        <li key={p.id} className="bg-bg px-3 py-2">
                            <p className="flex justify-between gap-3 font-semibold">
                                <span className="truncate">{p.name}</span>
                                <span className="shrink-0 tabular-nums">
                                    {days(p.days)}
                                </span>
                            </p>
                            <p className="text-sm text-muted">
                                {p.dates
                                    .map(
                                        (d) =>
                                            // Part of a day (a morning, an afternoon or some hours): its hours.
                                            `${day(d.date)}${d.days < 1 ? ` (${Math.round(d.days * 8 * 10) / 10} h)` : ''}`,
                                    )
                                    .join(' · ')}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function DeductionTable({
    title,
    head,
    rows,
    total,
    empty,
}: {
    title: string;
    head: string[];
    rows: string[][];
    total: string[];
    empty: string;
}) {
    return (
        <section className="ocs-card min-w-0">
            <h3 className="font-semibold">{title}</h3>
            {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{empty}</p>
            ) : (
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm tabular-nums">
                        <thead>
                            <tr className="text-muted">
                                {head.map((h, i) => (
                                    <th
                                        key={h}
                                        className={`py-1 pr-3 font-normal ${i > 0 ? 'text-right' : ''}`}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    {r.map((cell, j) => (
                                        <td
                                            key={j}
                                            className={`py-1 pr-3 ${j > 0 ? 'text-right' : ''}`}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-semibold">
                                {total.map((cell, j) => (
                                    <td
                                        key={j}
                                        className={`pt-2 pr-3 ${j > 0 ? 'text-right' : ''}`}
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
}

Analytics.layout = {
    breadcrumbs: [{ title: 'Analytics', href: analyticsIndex() }],
};
