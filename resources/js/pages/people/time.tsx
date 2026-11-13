import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import TeamTimeController from '@/actions/App/Http/Controllers/TeamTimeController';
import InputError from '@/components/input-error';
import type { LateEntry } from '@/components/log-late-dialog';
import {
    clock,
    duration,
    LATE_KINDS,
    LogLateDialog,
    RemoveLate,
} from '@/components/log-late-dialog';
import { PeopleTabs } from '@/components/people-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { time as timeRoute } from '@/routes/people';

type Row = {
    id: number;
    name: string;
    time_in: string | null;
    lunch_start: string | null;
    lunch_end: string | null;
    time_out: string | null;
    lates: LateEntry[];
};

type Props = {
    date: string;
    prev: string;
    next: string;
    is_today: boolean;
    rows: Row[];
};

const STEPS = [
    ['time_in', 'In'],
    ['lunch_start', 'Lunch'],
    ['lunch_end', 'Back'],
    ['time_out', 'Out'],
] as const;

const longDay = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

/**
 * People → Time (HR): a day's stamps and declared lates for everyone. HR fixes a stamp (in order) or adds a
 * late someone forgot to log, even in a paid-out period. Stamps are a record; only lates are charged.
 */
export default function TeamTime({ date, prev, next, is_today, rows }: Props) {
    const lateCount = rows.reduce((n, r) => n + r.lates.length, 0);
    const inCount = rows.filter((r) => r.time_in).length;

    return (
        <>
            <Head title="Time" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Time</h2>
            <PeopleTabs />

            <p className="mb-6 max-w-prose text-sm text-muted">
                Everyone&rsquo;s stamps for a day, and the lates they declared.
                Only lates are charged, on the payslip&rsquo;s Tardiness line.
                Fix a stamp or add a missed late here.
            </p>

            {/* Day switcher: big tap targets either side, weekdays only. */}
            <div className="mb-6 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={timeRoute({ query: { date: prev } })}
                        preserveScroll
                        aria-label="Previous weekday"
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="ocs-eyebrow mb-0">
                        {is_today ? 'Today · ' : ''}
                        {inCount} in · {lateCount}{' '}
                        {lateCount === 1 ? 'late' : 'lates'}
                    </p>
                    <label className="relative inline-flex cursor-pointer items-center font-semibold">
                        {longDay(date)}
                        <input
                            type="date"
                            aria-label="Pick a day"
                            value={date}
                            onChange={(e) =>
                                e.target.value &&
                                router.get(
                                    timeRoute.url({
                                        query: { date: e.target.value },
                                    }),
                                )
                            }
                            className="absolute inset-0 opacity-0"
                        />
                    </label>
                </div>
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={timeRoute({ query: { date: next } })}
                        preserveScroll
                        aria-label="Next weekday"
                    >
                        <ChevronRight />
                    </Link>
                </Button>
            </div>

            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {rows.map((r) => (
                    <PersonDay key={`${r.id}-${date}`} row={r} date={date} />
                ))}
            </ul>
        </>
    );
}

function PersonDay({ row, date }: { row: Row; date: string }) {
    const form = useForm({
        time_in: row.time_in ?? '',
        lunch_start: row.lunch_start ?? '',
        lunch_end: row.lunch_end ?? '',
        time_out: row.time_out ?? '',
    });
    const first = row.name.split(' ')[0];

    const save = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) =>
            Object.fromEntries(
                Object.entries(d).map(([k, v]) => [k, v === '' ? null : v]),
            ),
        );
        form.submit(TeamTimeController.update({ user: row.id, date }), {
            preserveScroll: true,
        });
    };

    return (
        <li className="min-w-0 bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{row.name}</p>
                <LogLateDialog
                    action={TeamTimeController.storeLate(row.id)}
                    today={date}
                    idPrefix={`late-${row.id}`}
                    title={`Add a late for ${first}`}
                    description="For a late they posted on WIP but didn't log. Only office hours are charged."
                    trigger={
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Add a late for ${row.name}`}
                        >
                            <Plus /> Late
                        </Button>
                    }
                />
            </div>

            <form onSubmit={save} className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STEPS.map(([key, label]) => (
                        <div key={key} className="grid min-w-0 gap-1">
                            <Label
                                htmlFor={`t-${row.id}-${key}`}
                                className="text-xs text-muted"
                            >
                                {label}
                            </Label>
                            <Input
                                id={`t-${row.id}-${key}`}
                                type="time"
                                value={form.data[key]}
                                onChange={(e) =>
                                    form.setData(key, e.target.value)
                                }
                                className="w-full min-w-0 px-2 font-mono"
                            />
                        </div>
                    ))}
                </div>
                <InputError
                    message={
                        form.errors.time_in ??
                        form.errors.lunch_start ??
                        form.errors.lunch_end ??
                        form.errors.time_out
                    }
                />
                {form.isDirty && (
                    <Button
                        type="submit"
                        variant="secondary"
                        disabled={form.processing}
                        className="justify-self-start"
                    >
                        {form.processing && <Spinner />}
                        Save times
                    </Button>
                )}
            </form>

            {row.lates.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-1">
                    {row.lates.map((l) => (
                        <li
                            key={l.id}
                            className="flex items-center gap-2 bg-bg py-1 pr-1 pl-3 text-sm"
                        >
                            <span className="ocs-badge">
                                {
                                    LATE_KINDS.find((k) => k.value === l.kind)
                                        ?.label
                                }
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="font-mono">
                                    {clock(l.start_time)}–{clock(l.end_time)}
                                </span>{' '}
                                · {duration(l.minutes)}
                                {l.note && ` · ${l.note}`}
                            </span>
                            <RemoveLate entry={l} who={row.name} />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

TeamTime.layout = {
    breadcrumbs: [{ title: 'Time', href: timeRoute() }],
};
