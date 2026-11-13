import { Head } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import type { LateEntry } from '@/components/log-late-dialog';
import {
    clock,
    duration,
    LATE_KINDS,
    RemoveLate,
} from '@/components/log-late-dialog';
import type { Today } from '@/components/time-today';
import { TimeToday } from '@/components/time-today';
import { index as timeIndex } from '@/routes/time';

type Props = {
    today: Today;
    period: {
        start: string;
        end: string;
        minutes: number;
        pesos: number | null;
    };
    lates: (LateEntry & { locked: boolean })[];
    wip_attendance: string;
};

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...o }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const day = (iso: string) =>
    fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const short = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
const kindLabel = (k: string) =>
    LATE_KINDS.find((x) => x.value === k)?.label ?? k;

export default function Time({ today, period, lates, wip_attendance }: Props) {
    const inPeriod = lates.filter(
        (l) => l.date >= period.start && l.date <= period.end,
    );
    const earlier = lates.filter((l) => l.date < period.start);

    return (
        <>
            <Head title="Time" />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="ocs-eyebrow">Time</p>
                    <h2 className="text-2xl font-semibold">My time</h2>
                </div>
            </div>

            <div className="ocs-grid mb-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <TimeToday today={today} wipUrl={wip_attendance} />
                </div>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">
                        This pay period · {short(period.start)}–
                        {short(period.end)}
                    </p>
                    <p
                        className={`text-3xl font-semibold ${period.minutes > 0 ? 'text-danger' : 'text-ink'}`}
                    >
                        {period.minutes > 0
                            ? duration(period.minutes)
                            : 'No lates'}
                    </p>
                    <p className="mt-1">
                        {period.minutes > 0
                            ? period.pesos !== null
                                ? `${peso(period.pesos)} off this payslip (Tardiness), at your hourly rate.`
                                : 'Charged at your hourly rate once HR sets your salary.'
                            : 'Nothing comes off your pay for time.'}
                    </p>
                </section>
            </div>

            <LateList
                title="This pay period"
                entries={inPeriod}
                empty="No lates logged this pay period."
            />
            {earlier.length > 0 && (
                <LateList title="Earlier" entries={earlier} empty="" />
            )}
        </>
    );
}

function LateList({
    title,
    entries,
    empty,
}: {
    title: string;
    entries: Props['lates'];
    empty: string;
}) {
    return (
        <section className="mb-6">
            <h3 className="ocs-eyebrow mb-3">{title}</h3>
            {entries.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">{empty}</p>
            ) : (
                <ul className="grid gap-2">
                    {entries.map((l) => (
                        <li
                            key={l.id}
                            className="flex min-h-14 items-center gap-3 bg-surface py-2 pr-2 pl-4"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {day(l.date)}
                                    <span className="ocs-badge ml-2">
                                        {kindLabel(l.kind)}
                                    </span>
                                </p>
                                <p className="truncate text-sm text-muted">
                                    <span className="font-mono">
                                        {clock(l.start_time)}–
                                        {clock(l.end_time)}
                                    </span>{' '}
                                    · {duration(l.minutes)}
                                    {l.note && ` · ${l.note}`}
                                </p>
                            </div>
                            {l.locked ? (
                                <span
                                    className="flex items-center gap-1 px-2 text-xs text-muted"
                                    title="This pay period is paid out. Ask HR to change it."
                                >
                                    <Lock className="size-3.5" /> paid
                                </span>
                            ) : (
                                <RemoveLate entry={l} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

Time.layout = {
    breadcrumbs: [{ title: 'Time', href: timeIndex() }],
};
