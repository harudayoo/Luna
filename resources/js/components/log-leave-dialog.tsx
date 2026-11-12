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
import { Spinner } from '@/components/ui/spinner';
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * Logging leave: a day, a half day or a range, with an optional note. Used for your own leave
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
                                <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1">
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

type Part = 'full' | 'am' | 'pm';

const PARTS: { value: Part; label: string; hint: string }[] = [
    { value: 'full', label: 'Full day', hint: '1 day' },
    { value: 'am', label: 'Morning', hint: 'AM · ½ day' },
    { value: 'pm', label: 'Afternoon', hint: 'PM · ½ day' },
];

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
