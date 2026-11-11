import { Form, Head, router } from '@inertiajs/react';
import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import LeaveController from '@/actions/App/Http/Controllers/LeaveController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
                <LogLeaveDialog />
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
                                        `: ${peso(current.deducted_pesos)} off this payroll`}
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
                        {month.used}{' '}
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
                                    {l.days === 0.5 && (
                                        <span className="ocs-badge ml-2">
                                            half day
                                        </span>
                                    )}
                                </p>
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

function LogLeaveDialog() {
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(today());
    const [to, setTo] = useState('');
    const range = to !== '' && to !== from;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Log leave</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>Log leave</DialogTitle>
                <DialogDescription>
                    No approval needed. Weekends in a range are skipped.
                </DialogDescription>

                <Form
                    {...LeaveController.store.form()}
                    resetOnSuccess
                    onSuccess={() => {
                        setOpen(false);
                        setTo('');
                    }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="from">From</Label>
                                    <Input
                                        id="from"
                                        name="from"
                                        type="date"
                                        required
                                        value={from}
                                        onChange={(e) =>
                                            setFrom(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="to">To (optional)</Label>
                                    <Input
                                        id="to"
                                        name="to"
                                        type="date"
                                        min={from}
                                        value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            <InputError message={errors.from ?? errors.to} />

                            <div className="flex min-h-10 items-center gap-3">
                                <Checkbox
                                    id="half_day"
                                    name="half_day"
                                    value="1"
                                    disabled={range}
                                />
                                <Label
                                    htmlFor="half_day"
                                    className={range ? 'text-muted' : ''}
                                >
                                    Half day {range && '(single dates only)'}
                                </Label>
                            </div>
                            <InputError message={errors.half_day} />

                            <div className="grid gap-2">
                                <Label htmlFor="note">Note (optional)</Label>
                                <Input
                                    id="note"
                                    name="note"
                                    maxLength={80}
                                    placeholder="e.g. Dentist, family trip"
                                />
                                <InputError message={errors.note} />
                            </div>

                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Log leave
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

MyLeave.layout = {
    breadcrumbs: [{ title: 'My leave', href: leaveIndex() }],
};
