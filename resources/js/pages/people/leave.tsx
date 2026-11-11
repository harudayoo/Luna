import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import LeaveController from '@/actions/App/Http/Controllers/LeaveController';
import { PeopleTabs } from '@/components/people-tabs';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { leave as leaveRoute } from '@/routes/people';

type Entry = {
    id: number;
    date: string;
    days: number;
    note: string | null;
    /** A holiday falls on it: kept, but not charged. */
    holiday: string | null;
};

type Row = {
    id: number;
    name: string;
    started: boolean;
    start_balance: number;
    accrued: number;
    taken_hours: number;
    balance: number;
    deducted_hours: number;
    deducted_pesos: number | null;
    has_rate: boolean;
    leaves: Entry[];
};

type Props = {
    cutoff: {
        start: string;
        end: string;
        prev: string;
        next: string;
        ended: boolean;
        is_current: boolean;
        holidays: { date: string; name: string }[];
    };
    rows: Row[];
    totals: {
        taken_hours: number;
        deducted_hours: number;
        deducted_pesos: number;
    };
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const short = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const day = (iso: string) =>
    fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const hours = (h: number) => `${h.toFixed(2)} h`;
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);

/** Leave & pay (HR): one cut-off, everyone's leave, balance and deduction. */
export default function TeamLeave({ cutoff, rows, totals }: Props) {
    const onLeave = rows.filter((r) => r.leaves.length > 0);
    const missingRate = rows.filter((r) => r.deducted_hours > 0 && !r.has_rate);

    return (
        <>
            <Head title="Leave & pay" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Leave &amp; pay</h2>
            <PeopleTabs />

            {/* Cut-off switcher: big tap targets either side, the period in the middle. */}
            <div className="mb-6 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={leaveRoute({ query: { cutoff: cutoff.prev } })}
                        preserveScroll
                        aria-label="Previous cut-off"
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="ocs-eyebrow mb-0">
                        {cutoff.is_current
                            ? 'This cut-off'
                            : cutoff.ended
                              ? 'In payroll'
                              : 'Coming up'}
                    </p>
                    <p className="font-semibold">
                        {short(cutoff.start)} –{' '}
                        {fmt(cutoff.end, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={leaveRoute({ query: { cutoff: cutoff.next } })}
                        preserveScroll
                        aria-label="Next cut-off"
                    >
                        <ChevronRight />
                    </Link>
                </Button>
            </div>
            {cutoff.holidays.length > 0 && (
                <p className="-mt-4 mb-6 text-center text-sm text-muted">
                    Holidays:{' '}
                    {cutoff.holidays
                        .map((h) => `${short(h.date)} ${h.name}`)
                        .join(' · ')}
                </p>
            )}

            {/* Gist first: how much leave, and what it costs this payroll. */}
            <div className="ocs-grid mb-6">
                <section className="ocs-card">
                    <p className="ocs-eyebrow">On leave</p>
                    <p className="text-3xl font-semibold text-ink">
                        {onLeave.length}{' '}
                        <span className="text-base text-muted">
                            of {rows.length} people
                        </span>
                    </p>
                    <p className="mt-1">
                        {hours(totals.taken_hours)} taken in total
                    </p>
                </section>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Payroll deductions</p>
                    <p
                        className={`text-3xl font-semibold ${totals.deducted_hours > 0 ? 'text-danger' : 'text-ink'}`}
                    >
                        {totals.deducted_pesos > 0
                            ? peso(totals.deducted_pesos)
                            : '₱0.00'}
                    </p>
                    <p className="mt-1">
                        {hours(totals.deducted_hours)} unpaid
                        {missingRate.length > 0 &&
                            ` · ${missingRate.length} without a daily rate, not counted`}
                    </p>
                </section>
            </div>

            <ul className="grid gap-2">
                {rows.map((r) => (
                    <li key={r.id} className="grid gap-3 bg-surface p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <p className="font-semibold">{r.name}</p>
                            {!r.started ? (
                                <span className="text-sm text-muted">
                                    Not started yet
                                </span>
                            ) : r.deducted_hours > 0 ? (
                                <span className="text-sm font-semibold text-danger">
                                    −{hours(r.deducted_hours)}
                                    {r.deducted_pesos !== null
                                        ? ` · ${peso(r.deducted_pesos)}`
                                        : ' · no daily rate'}
                                </span>
                            ) : (
                                <span className="text-sm text-success">
                                    {hours(r.balance)} left
                                </span>
                            )}
                        </div>
                        {r.started && (
                            <p className="text-xs text-muted">
                                Started with {hours(r.start_balance)} · earned{' '}
                                {hours(r.accrued)} · took {hours(r.taken_hours)}
                            </p>
                        )}
                        {r.leaves.length > 0 && (
                            <ul className="flex flex-wrap gap-2">
                                {r.leaves.map((l) => (
                                    <li
                                        key={l.id}
                                        className="flex items-center gap-1 bg-bg py-1 pr-1 pl-3 text-sm"
                                        title={
                                            l.holiday
                                                ? `${l.holiday}: not charged`
                                                : (l.note ?? undefined)
                                        }
                                    >
                                        {day(l.date)}
                                        {l.days === 0.5 && (
                                            <span className="text-xs text-muted">
                                                ½
                                            </span>
                                        )}
                                        {l.holiday && (
                                            <span className="text-xs text-muted">
                                                holiday
                                            </span>
                                        )}
                                        <CancelLeave name={r.name} entry={l} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}

/** HR can cancel anyone's leave, even in a cut-off that's in payroll (to fix mistakes). */
function CancelLeave({ name, entry }: { name: string; entry: Entry }) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={`Cancel ${name}'s leave on ${day(entry.date)}`}
                >
                    <X />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    Cancel {name}&rsquo;s leave on {day(entry.date)}?
                </DialogTitle>
                <DialogDescription>
                    Their balance and this cut-off&rsquo;s deduction are
                    recalculated. If payroll already ran, adjust it by hand.
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Keep it</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                            router.delete(
                                LeaveController.destroy(entry.id).url,
                                {
                                    preserveScroll: true,
                                    onStart: () => setBusy(true),
                                    onFinish: () => setBusy(false),
                                },
                            )
                        }
                    >
                        {busy && <Spinner />}
                        Cancel leave
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

TeamLeave.layout = {
    breadcrumbs: [{ title: 'Leave & pay', href: leaveRoute() }],
};
