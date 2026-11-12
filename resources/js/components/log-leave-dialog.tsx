import { Form } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * Logging leave: a day, a half day, some hours of a day, or a range of them, with an optional note. Used for your own leave
 * (My leave) and by HR for someone else's (Leave & pay); the server applies the rules.
 */
export function LogLeaveDialog({
    form,
    title,
    description,
    trigger,
    defaultFrom,
    idPrefix = 'leave',
}: {
    form: RouteFormDefinition<'post'>;
    title: string;
    description: string;
    trigger: ReactNode;
    /** Y-m-d the "From" field starts on. */
    defaultFrom: string;
    /** Keeps field ids unique when a page has several dialogs. */
    idPrefix?: string;
}) {
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState('');
    const [part, setPart] = useState<Part>('full');
    const [start, setStart] = useState('13:00');
    const [end, setEnd] = useState('15:00');
    const id = (field: string) => `${idPrefix}-${field}`;
    const presets = timeframes();
    const pick = (p: Timeframe) => {
        setFrom(p.from);
        setTo(p.to === p.from ? '' : p.to);
    };
    const isPicked = (p: Timeframe) =>
        p.from === from &&
        (p.to === p.from ? to === '' || to === from : p.to === to);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <Form
                    {...form}
                    resetOnSuccess
                    options={{ preserveScroll: true }}
                    onSuccess={() => {
                        setOpen(false);
                        setTo('');
                        setPart('full');
                    }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            {/* Quick timeframes fill the dates; the dates stay editable (custom). */}
                            <div
                                className="flex flex-wrap gap-2"
                                role="group"
                                aria-label="Timeframe"
                            >
                                {presets.map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() => pick(p)}
                                        aria-pressed={isPicked(p)}
                                        className="min-h-10 bg-surface-hover px-3 text-sm font-semibold text-ink hover:shadow-lift aria-pressed:bg-primary aria-pressed:text-on-primary"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        document
                                            .getElementById(id('from'))
                                            ?.focus()
                                    }
                                    aria-pressed={!presets.some(isPicked)}
                                    className="min-h-10 bg-surface-hover px-3 text-sm font-semibold text-ink hover:shadow-lift aria-pressed:bg-primary aria-pressed:text-on-primary"
                                >
                                    Custom
                                </button>
                            </div>

                            {/* Side by side only when both date pickers fit. */}
                            <div className="grid gap-3 min-[400px]:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor={id('from')}>From</Label>
                                    <Input
                                        id={id('from')}
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
                                    <Label htmlFor={id('to')}>
                                        To (optional)
                                    </Label>
                                    <Input
                                        id={id('to')}
                                        name="to"
                                        type="date"
                                        min={from}
                                        value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            <InputError message={errors.from ?? errors.to} />

                            {/* Full day or a half: segmented, like the People tabs. Works on a range too. */}
                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">
                                    How long each day
                                </legend>
                                <div className="grid grid-cols-2 gap-1 bg-surface-hover p-1 sm:grid-cols-4">
                                    {PARTS.map((p) => (
                                        <label
                                            key={p.value}
                                            className="flex min-h-10 cursor-pointer flex-col items-center justify-center px-2 text-center text-sm font-semibold text-muted has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:shadow-lift"
                                        >
                                            <input
                                                type="radio"
                                                name="part"
                                                value={p.value}
                                                checked={part === p.value}
                                                onChange={() =>
                                                    setPart(p.value)
                                                }
                                                className="sr-only"
                                            />
                                            {p.label}
                                            <span className="text-xs font-normal opacity-80">
                                                {p.hint}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <InputError message={errors.part} />

                            {/* Some hours of the day: on the half hour, office hours only; lunch isn't charged. */}
                            {part === 'hours' && (
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <TimeField
                                            id={id('start')}
                                            name="start_time"
                                            label="From"
                                            value={start}
                                            onChange={(t) => {
                                                setStart(t);
                                                if (end <= t) {
                                                    setEnd(
                                                        TIMES[
                                                            TIMES.indexOf(t) + 1
                                                        ],
                                                    );
                                                }
                                            }}
                                            options={TIMES.slice(0, -1)}
                                        />
                                        <TimeField
                                            id={id('end')}
                                            name="end_time"
                                            label="To"
                                            value={end}
                                            onChange={setEnd}
                                            options={TIMES.filter(
                                                (t) => t > start,
                                            )}
                                        />
                                    </div>
                                    <p className="text-sm text-muted">
                                        {workingHours(start, end) > 0
                                            ? `${workingHours(start, end)} h of PTO each day (lunch 12–1 isn't counted).`
                                            : "That's the lunch hour: pick some working time."}
                                    </p>
                                    <InputError
                                        message={
                                            errors.start_time ?? errors.end_time
                                        }
                                    />
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor={id('note')}>
                                    Note (optional)
                                </Label>
                                <Input
                                    id={id('note')}
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

type Part = 'full' | 'am' | 'pm' | 'hours';

const PARTS: { value: Part; label: string; hint: string }[] = [
    { value: 'full', label: 'Full day', hint: '1 day' },
    { value: 'am', label: 'Morning', hint: '9–12 · 3 h' },
    { value: 'pm', label: 'Afternoon', hint: '1–6 · 5 h' },
    { value: 'hours', label: 'Hours', hint: 'pick the times' },
];

/** Office hours (Leave::OFFICE_HOURS on the server): 9:00–18:00 with lunch 12–1. */
const OFFICE: [string, string][] = [
    ['09:00', '12:00'],
    ['13:00', '18:00'],
];

/** Every half hour from opening to closing, "HH:MM". */
const TIMES = Array.from({ length: 19 }, (_, i) => {
    const m = 9 * 60 + i * 30;

    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`;
});

const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Working hours between two times: office hours only, lunch left out (as Leave::workingHours). */
export function workingHours(start: string, end: string): number {
    return (
        OFFICE.reduce(
            (sum, [open, close]) =>
                sum +
                Math.max(
                    0,
                    Math.min(minutes(end), minutes(close)) -
                        Math.max(minutes(start), minutes(open)),
                ),
            0,
        ) / 60
    );
}

/** "1:30 PM" from "13:30". */
export function clock(t: string): string {
    const h = Number(t.slice(0, 2));

    return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
}

type LeaveLength = {
    days: number;
    part: 'am' | 'pm' | null;
    start_time?: string | null;
    end_time?: string | null;
};

/**
 * How much of the day a leave covers, for badges: "1:00–3:30 PM · 2.5 h", "AM · 3 h", "PM · 5 h",
 * "half day", or null for a full day. `short` gives the chip form: "1:00–3:30 PM", "AM", "PM", "½".
 * A morning or afternoon shows the hours it was charged (days × 8): 3 h / 5 h since 2026-11-12,
 * 4 h for ones logged before.
 */
export function leaveLength(l: LeaveLength, short = false): string | null {
    if (l.start_time && l.end_time) {
        const [a, b] = [clock(l.start_time), clock(l.end_time)];
        const range =
            a.slice(-2) === b.slice(-2)
                ? `${a.slice(0, -3)}–${b}`
                : `${a}–${b}`;

        return short
            ? range
            : `${range} · ${workingHours(l.start_time, l.end_time)} h`;
    }
    if (l.part) {
        const name = l.part.toUpperCase();

        return short ? name : `${name} · ${Math.round(l.days * 8 * 10) / 10} h`;
    }
    if (l.days === 0.5) {
        return short ? '½' : 'half day';
    }

    return null;
}

function TimeField({
    id,
    name,
    label,
    value,
    onChange,
    options,
}: {
    id: string;
    name: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select name={name} value={value} onValueChange={onChange}>
                <SelectTrigger id={id} className="min-h-10 w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((t) => (
                        <SelectItem key={t} value={t}>
                            {clock(t)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

type Timeframe = { label: string; from: string; to: string };

/** Y-m-d in local time. */
const iso = (d: Date) => d.toLocaleDateString('en-CA');
const plus = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);

    return x;
};

/** Today, Tomorrow, the rest of this week (weekdays only) and next Mon–Fri. */
function timeframes(): Timeframe[] {
    const now = new Date();
    const dow = now.getDay(); // 0 Sun … 6 Sat
    const weekday = dow >= 1 && dow <= 5;
    const nextMonday = plus(now, (8 - dow) % 7 || 7);
    const list: Timeframe[] = [
        { label: 'Today', from: iso(now), to: iso(now) },
        { label: 'Tomorrow', from: iso(plus(now, 1)), to: iso(plus(now, 1)) },
    ];
    if (weekday && dow < 5) {
        list.push({
            label: 'This week',
            from: iso(now),
            to: iso(plus(now, 5 - dow)),
        });
    }
    list.push({
        label: 'Next week',
        from: iso(nextMonday),
        to: iso(plus(nextMonday, 4)),
    });

    return list;
}
