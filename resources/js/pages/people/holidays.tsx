import { Form, Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import HolidayController from '@/actions/App/Http/Controllers/HolidayController';
import InputError from '@/components/input-error';
import { PeopleTabs } from '@/components/people-tabs';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { holidays as holidaysRoute } from '@/routes/people';

type Kind = 'regular' | 'special';

type Holiday = {
    id: number;
    date: string;
    name: string;
    kind: Kind;
    leave_count: number;
};

type Props = {
    year: number;
    holidays: Holiday[];
    /** People on leave per Y-m-d this year, to warn before a holiday lands on it. */
    leave_dates: Record<string, number>;
};

const KINDS: Record<Kind, string> = {
    regular: 'Regular holiday',
    special: 'Special non-working day',
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const day = (iso: string) =>
    fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const month = (iso: string) => fmt(iso, { month: 'long' });
const today = () => new Date().toLocaleDateString('en-CA'); // Y-m-d, local
const people = (n: number) => (n === 1 ? '1 person' : `${n} people`);

/** Holidays (HR): the office's non-working days. They earn no work hours and can't be logged as leave. */
export default function Holidays({ year, holidays, leave_dates }: Props) {
    const next = holidays.find((h) => h.date >= today());
    const byMonth = holidays.reduce<Record<string, Holiday[]>>((acc, h) => {
        (acc[month(h.date)] ??= []).push(h);

        return acc;
    }, {});

    return (
        <>
            <Head title="Holidays" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Holidays</h2>
            <PeopleTabs />

            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <p className="max-w-prose text-sm text-muted">
                    Days the office is closed. They don&rsquo;t count as work
                    hours and can&rsquo;t be logged as leave. Add Eid&rsquo;l
                    Fitr and Eid&rsquo;l Adha once they&rsquo;re proclaimed.
                </p>
                <HolidayDialog year={year} leaveDates={leave_dates} />
            </div>

            {/* Year switcher: big tap targets either side, as on Leave & pay. */}
            <div className="mb-6 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={holidaysRoute({ query: { year: year - 1 } })}
                        preserveScroll
                        aria-label="Previous year"
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="ocs-eyebrow mb-0">
                        {holidays.length}{' '}
                        {holidays.length === 1 ? 'holiday' : 'holidays'}
                    </p>
                    <p className="font-semibold">{year}</p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={holidaysRoute({ query: { year: year + 1 } })}
                        preserveScroll
                        aria-label="Next year"
                    >
                        <ChevronRight />
                    </Link>
                </Button>
            </div>

            {next && (
                <section className="ocs-card mb-6">
                    <p className="ocs-eyebrow">Next holiday</p>
                    <p className="text-2xl font-semibold text-ink">
                        {next.name}
                    </p>
                    <p className="mt-1">
                        {day(next.date)} · {KINDS[next.kind]}
                    </p>
                </section>
            )}

            {holidays.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    No holidays for {year} yet. Add them once the year&rsquo;s
                    proclamation is out.
                </p>
            ) : (
                Object.entries(byMonth).map(([name, list]) => (
                    <section key={name} className="mb-6">
                        <h3 className="ocs-eyebrow mb-3">{name}</h3>
                        <ul className="grid gap-2">
                            {list.map((h) => (
                                <HolidayRow
                                    key={h.id}
                                    holiday={h}
                                    year={year}
                                    leaveDates={leave_dates}
                                />
                            ))}
                        </ul>
                    </section>
                ))
            )}
        </>
    );
}

function HolidayRow({
    holiday,
    year,
    leaveDates,
}: {
    holiday: Holiday;
    year: number;
    leaveDates: Record<string, number>;
}) {
    const past = holiday.date < today();

    return (
        <li className="flex min-h-14 items-center gap-3 bg-surface py-2 pr-2 pl-4">
            <div className="min-w-0 flex-1">
                <p className={`font-semibold ${past ? 'text-muted' : ''}`}>
                    {day(holiday.date)}
                    <span
                        className={`ocs-badge ml-2 ${holiday.kind === 'regular' ? 'text-primary' : ''}`}
                    >
                        {holiday.kind === 'regular' ? 'regular' : 'special'}
                    </span>
                </p>
                <p className="truncate text-sm text-muted">{holiday.name}</p>
                {holiday.leave_count > 0 && (
                    <p className="text-xs text-muted">
                        {people(holiday.leave_count)} logged leave on it · not
                        charged
                    </p>
                )}
            </div>
            <HolidayDialog
                year={year}
                leaveDates={leaveDates}
                holiday={holiday}
            />
            <DeleteHoliday holiday={holiday} />
        </li>
    );
}

/** Add (no `holiday`) or edit one. Warns when the date already has leave on it. */
function HolidayDialog({
    year,
    leaveDates,
    holiday,
}: {
    year: number;
    leaveDates: Record<string, number>;
    holiday?: Holiday;
}) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState(holiday?.date ?? '');
    const [kind, setKind] = useState<Kind>(holiday?.kind ?? 'regular');
    const onLeave = date.startsWith(`${year}-`) ? (leaveDates[date] ?? 0) : 0;
    const form = holiday
        ? HolidayController.update.form(holiday.id)
        : HolidayController.store.form();

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);

                if (o) {
                    setDate(holiday?.date ?? '');
                    setKind(holiday?.kind ?? 'regular');
                }
            }}
        >
            <DialogTrigger asChild>
                {holiday ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${holiday.name}`}
                    >
                        <Pencil />
                    </Button>
                ) : (
                    <Button>Add holiday</Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>
                    {holiday ? `Edit ${holiday.name}` : 'Add a holiday'}
                </DialogTitle>
                <DialogDescription>
                    Applies to everyone. Balances are recalculated straight
                    away.
                </DialogDescription>
                <Form
                    {...form}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`name-${holiday?.id ?? 'new'}`}>
                                    Name
                                </Label>
                                <Input
                                    id={`name-${holiday?.id ?? 'new'}`}
                                    name="name"
                                    maxLength={80}
                                    autoComplete="off"
                                    defaultValue={holiday?.name}
                                    placeholder="e.g. Eid’l Fitr"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`date-${holiday?.id ?? 'new'}`}>
                                    Date
                                </Label>
                                <Input
                                    id={`date-${holiday?.id ?? 'new'}`}
                                    name="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                                <InputError message={errors.date} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`kind-${holiday?.id ?? 'new'}`}>
                                    Kind
                                </Label>
                                <Select
                                    name="kind"
                                    value={kind}
                                    onValueChange={(v) => setKind(v as Kind)}
                                >
                                    <SelectTrigger
                                        id={`kind-${holiday?.id ?? 'new'}`}
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(KINDS) as Kind[]).map(
                                            (k) => (
                                                <SelectItem key={k} value={k}>
                                                    {KINDS[k]}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.kind} />
                            </div>

                            {onLeave > 0 && date !== holiday?.date && (
                                <div className="grid gap-2 bg-surface p-3">
                                    <p className="text-sm">
                                        {people(onLeave)} logged leave on this
                                        date. It&rsquo;s kept but not charged.
                                    </p>
                                    <div className="flex min-h-10 items-center gap-3">
                                        <Checkbox
                                            id={`cancel-${holiday?.id ?? 'new'}`}
                                            name="cancel_leave"
                                            value="1"
                                        />
                                        <Label
                                            htmlFor={`cancel-${holiday?.id ?? 'new'}`}
                                        >
                                            Cancel that leave instead
                                        </Label>
                                    </div>
                                </div>
                            )}

                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                {holiday ? 'Save' : 'Add holiday'}
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Removing a holiday makes leave on that date count again, so it asks first. */
function DeleteHoliday({ holiday }: { holiday: Holiday }) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${holiday.name}`}
                >
                    <Trash2 />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Remove {holiday.name}?</DialogTitle>
                <DialogDescription>
                    {day(holiday.date)} becomes a working day again
                    {holiday.leave_count > 0 &&
                        `, and the leave ${people(holiday.leave_count)} logged on it is charged`}
                    .
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
                                HolidayController.destroy(holiday.id).url,
                                {
                                    preserveScroll: true,
                                    onStart: () => setBusy(true),
                                    onFinish: () => setBusy(false),
                                },
                            )
                        }
                    >
                        {busy && <Spinner />}
                        Remove
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

Holidays.layout = {
    breadcrumbs: [{ title: 'Holidays', href: holidaysRoute() }],
};
