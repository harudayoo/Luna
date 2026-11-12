import { Head, router } from '@inertiajs/react';
import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import LeaveController from '@/actions/App/Http/Controllers/LeaveController';
import { leaveLength, LogLeaveDialog } from '@/components/log-leave-dialog';
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
import { index as leaveIndex } from '@/routes/leave';

type CutOff = {
    start: string;
    end: string;
    start_balance: number;
    accrued: number;
    taken_hours: number;
    balance: number;
    deducted_hours: number;
    deducted_pesos: number | null;
};

type LeaveEntry = {
    id: number;
    date: string;
    days: number;
    note: string | null;
    locked: boolean;
    /** "am" / "pm" for a half day (older half days have none). */
    part: 'am' | 'pm' | null;
    start_time: string | null;
    end_time: string | null;
    /** The holiday's name if one falls on this date: kept, but not charged. */
    holiday: string | null;
};

type Props = {
    balance_hours: number;
    hours_per_day: number;
    current: CutOff | null;
    month: { label: string; used: number; cap: number };
    leaves: LeaveEntry[];
    history: CutOff[];
    pto_start: string;
};

// Dates arrive as Y-m-d; format them in UTC so the day never shifts with the time zone.
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const day = (iso: string) =>
    fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const short = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const hours = (h: number) => `${h.toFixed(2)} h`;
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
const today = () => new Date().toLocaleDateString('en-CA'); // Y-m-d, local

export default function MyLeave(props: Props) {
    const { balance_hours, hours_per_day, current, month, leaves, history } =
        props;
    const upcoming = leaves.filter((l) => l.date >= today()).reverse();
    const past = leaves.filter((l) => l.date < today());

    return (
        <>
            <Head title="My leave" />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="ocs-eyebrow">Leave</p>
                    <h2 className="text-2xl font-semibold">My leave</h2>
                </div>
                <LogLeaveDialog
                    form={LeaveController.store.form()}
                    title="Log leave"
                    description="No approval needed. Weekends and holidays in a range are skipped."
                    trigger={<Button>Log leave</Button>}
                    defaultFrom={today()}
                />
            </div>

            {/* Gist first: what you have, what this cut-off does to it, how much of the month is left. */}
            <div className="ocs-grid mb-8">
                <section className="ocs-card">
                    <p className="ocs-eyebrow">PTO balance</p>
                    <p className="text-3xl font-semibold text-ink">
                        {hours(balance_hours)}
                    </p>
                    <p className="mt-1">
                        {(balance_hours / hours_per_day).toFixed(2)} days
                        {current && (
                            <>
                                {' '}
                                · +{hours(current.accrued)} on{' '}
                                {short(current.end)}
                            </>
                        )}
                    </p>
                </section>

                {current && (
                    <section className="ocs-card">
                        <p className="ocs-eyebrow">
                            This cut-off · {short(current.start)}–
                            {short(current.end)}
                        </p>
                        {current.deducted_hours > 0 ? (
                            <>
                                <p className="text-3xl font-semibold text-danger">
                                    −{hours(current.deducted_hours)}
                                </p>
                                <p className="mt-1">
                                    Unpaid
                                    {current.deducted_pesos !== null &&
                                        `: ${peso(current.deducted_pesos)} off next cut-off’s pay`}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-3xl font-semibold text-ink">
                                    {hours(current.balance)}
                                </p>
                                <p className="mt-1">
                                    After {hours(current.taken_hours)} of leave.
                                    No deduction.
                                </p>
                            </>
                        )}
                    </section>
                )}

                <section className="ocs-card">
                    <p className="ocs-eyebrow">{month.label}</p>
                    <p className="text-3xl font-semibold text-ink">
                        {/* Leave by the hour makes fractions of a day: 2 decimals at most. */}
                        {Math.round(month.used * 100) / 100}{' '}
                        <span className="text-base text-muted">
                            of {month.cap} days
                        </span>
                    </p>
                    <div
                        className="mt-3 h-2 bg-surface-hover"
                        aria-hidden="true"
                    >
                        <div
                            className="h-full bg-primary"
                            style={{
                                width: `${Math.min(100, (month.used / month.cap) * 100)}%`,
                            }}
                        />
                    </div>
                </section>
            </div>

            <LeaveList
                title="Coming up"
                entries={upcoming}
                empty="Nothing planned. Enjoy the work streak."
            />
            <LeaveList
                title="Earlier"
                entries={past}
                empty="No past leave yet."
            />

            {history.length > 0 && (
                <section className="mt-8">
                    <h3 className="ocs-eyebrow mb-3">This year by cut-off</h3>
                    <ul className="grid gap-2">
                        {history.map((c) => (
                            <li
                                key={c.start}
                                className="grid grid-cols-2 gap-x-4 gap-y-1 bg-surface p-4 text-sm sm:grid-cols-4 sm:items-center"
                            >
                                <span className="font-semibold">
                                    {short(c.start)}–{short(c.end)}
                                </span>
                                <span className="text-muted">
                                    took {hours(c.taken_hours)}
                                </span>
                                <span className="text-muted">
                                    earned {hours(c.accrued)}
                                </span>
                                <span
                                    className={
                                        c.deducted_hours > 0
                                            ? 'text-danger'
                                            : 'text-success'
                                    }
                                >
                                    {c.deducted_hours > 0
                                        ? `−${hours(c.deducted_hours)}${c.deducted_pesos !== null ? ` · ${peso(c.deducted_pesos)}` : ''}`
                                        : `${hours(c.balance)} left`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

function LeaveList({
    title,
    entries,
    empty,
}: {
    title: string;
    entries: LeaveEntry[];
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
                                    {leaveLength(l) && (
                                        <span className="ocs-badge ml-2">
                                            {leaveLength(l)}
                                        </span>
                                    )}
                                    {l.holiday && (
                                        <span className="ocs-badge ml-2">
                                            holiday · not charged
                                        </span>
                                    )}
                                </p>
                                {l.holiday && (
                                    <p className="truncate text-sm text-muted">
                                        {l.holiday}
                                    </p>
                                )}
                                {l.note && (
                                    <p className="truncate text-sm text-muted">
                                        {l.note}
                                    </p>
                                )}
                            </div>
                            {l.locked ? (
                                <span
                                    className="flex items-center gap-1 px-2 text-xs text-muted"
                                    title="Payroll ran for this cut-off. Ask HR to change it."
                                >
                                    <Lock className="size-3.5" /> in payroll
                                </span>
                            ) : (
                                <CancelLeave entry={l} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/** Accidental taps happen on phones: cancelling asks first. */
function CancelLeave({ entry }: { entry: LeaveEntry }) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Cancel leave on ${day(entry.date)}`}
                >
                    <X />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Cancel leave on {day(entry.date)}?</DialogTitle>
                <DialogDescription>
                    It comes off your record and your balance is recalculated.
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

MyLeave.layout = {
    breadcrumbs: [{ title: 'My leave', href: leaveIndex() }],
};
