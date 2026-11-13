import { router, useForm } from '@inertiajs/react';
import { Check, Copy, ExternalLink, Shuffle, X } from 'lucide-react';
import TimeController from '@/actions/App/Http/Controllers/TimeController';
import type { ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import type { RouteDefinition } from '@/wayfinder';

import type { LateDetails, LateKind } from '@/lib/wip-message';
import { clock, longDay, wipMessage } from '@/lib/wip-message';

export type { LateKind };
export { clock };

export type LateEntry = {
    id: number;
    date: string;
    kind: LateKind;
    start_time: string;
    end_time: string;
    minutes: number;
    note: string | null;
};

export const LATE_KINDS: {
    value: LateKind;
    label: string;
    hint: string;
    from: string;
    to: string;
}[] = [
    {
        value: 'late_in',
        label: 'Late in',
        hint: 'after 9:00',
        from: '09:00',
        to: '',
    },
    {
        value: 'lunch',
        label: 'Long lunch',
        hint: 'past 1:00',
        from: '13:00',
        to: '',
    },
    {
        value: 'early_out',
        label: 'Early out',
        hint: 'before 6:00',
        from: '',
        to: '18:00',
    },
    { value: 'errand', label: 'Errand', hint: 'during work', from: '', to: '' },
];

/** Office hours (Leave::OFFICE_HOURS on the server): only these minutes are charged. */
const OFFICE = [
    ['09:00', '12:00'],
    ['13:00', '18:00'],
] as const;

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Minutes of a span inside office hours, lunch left out (LateLog::chargedMinutes). */
export function chargedMinutes(from: string, to: string): number {
    if (!from || !to || to <= from) {
        return 0;
    }

    return OFFICE.reduce(
        (sum, [open, close]) =>
            sum +
            Math.max(
                0,
                Math.min(mins(to), mins(close)) -
                    Math.max(mins(from), mins(open)),
            ),
        0,
    );
}

export const duration = (m: number) =>
    m < 60
        ? `${m} min`
        : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;

/**
 * Declaring a late (honour system): what kind, when, and an optional note. Only office-hour minutes are
 * charged, at the hourly rate, on the payslip's Tardiness line. For your own late, the done step sends you
 * to WIP's Attendance channel with the message ready to paste; HR adding one for someone gets no WIP step.
 */
export function LogLateDialog({
    action,
    trigger,
    today,
    title = 'Log a late',
    description = 'Late in, a long lunch, early out or an errand. Only office hours (9–12, 1–6) are charged.',
    wipUrl,
    idPrefix = 'late',
}: {
    action: RouteDefinition<'post'>;
    trigger: ReactNode;
    /** Y-m-d, office time. */
    today: string;
    title?: string;
    description?: string;
    /** WIP's Attendance channel: shown after saving your own late. */
    wipUrl?: string;
    idPrefix?: string;
}) {
    const [open, setOpen] = useState(false);
    const [posted, setPosted] = useState<string | null>(null);
    const [late, setLate] = useState<LateDetails | null>(null);
    const [copied, copy] = useClipboard();
    const form = useForm({
        date: today,
        kind: 'late_in' as LateKind,
        start_time: '09:00',
        end_time: '',
        note: '',
    });
    const { data, setData, errors, processing } = form;
    const id = (f: string) => `${idPrefix}-${f}`;
    const charged = chargedMinutes(data.start_time, data.end_time);

    const pickKind = (k: (typeof LATE_KINDS)[number]) =>
        setData((d) => ({
            ...d,
            kind: k.value,
            start_time: k.from || (k.value === d.kind ? d.start_time : ''),
            end_time: k.to || (k.value === d.kind ? d.end_time : ''),
        }));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const details = { ...data };
        form.submit(action, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                if (wipUrl) {
                    setLate(details);
                    setPosted(wipMessage(details, today));
                } else {
                    setOpen(false);
                }
            },
        });
    };

    const openWip = () => {
        if (posted) {
            void copy(posted);
        }
        window.open(wipUrl, '_blank', 'noopener');
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                    setPosted(null);
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                {posted && wipUrl ? (
                    <div className="grid gap-4">
                        <DialogTitle>
                            Logged. Now tell the office on WIP
                        </DialogTitle>
                        <DialogDescription>
                            Post it in the OCS Attendance channel. Luna wrote it
                            for you; change anything, or reword it.
                        </DialogDescription>
                        <label htmlFor={`${idPrefix}-wip`} className="sr-only">
                            Message for WIP
                        </label>
                        <textarea
                            id={`${idPrefix}-wip`}
                            rows={4}
                            value={posted}
                            onChange={(e) => setPosted(e.target.value)}
                            className="w-full resize-y bg-surface-hover p-4 text-base text-ink focus-visible:shadow-lift focus-visible:outline-none md:text-sm"
                        />
                        <Button
                            onClick={openWip}
                            className="w-full"
                            disabled={posted.trim() === ''}
                        >
                            <ExternalLink /> Copy and open #attendance
                        </Button>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant="secondary"
                                className="bg-bg px-2"
                                onClick={() =>
                                    late && setPosted(wipMessage(late, today))
                                }
                            >
                                <Shuffle /> Reword
                            </Button>
                            <Button
                                variant="secondary"
                                className="bg-bg px-2"
                                onClick={() => void copy(posted)}
                            >
                                {copied === posted ? <Check /> : <Copy />}
                                {copied === posted ? 'Copied' : 'Copy'}
                            </Button>
                            <Button
                                variant="secondary"
                                className="bg-bg px-2"
                                onClick={() => setOpen(false)}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>

                        <form onSubmit={submit} className="grid gap-4">
                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">
                                    What happened
                                </legend>
                                <div className="grid grid-cols-2 gap-1 bg-surface-hover p-1 sm:grid-cols-4">
                                    {LATE_KINDS.map((k) => (
                                        <label
                                            key={k.value}
                                            className="flex min-h-12 cursor-pointer flex-col items-center justify-center px-2 text-center text-sm font-semibold text-muted has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:shadow-lift"
                                        >
                                            <input
                                                type="radio"
                                                name="kind"
                                                value={k.value}
                                                checked={data.kind === k.value}
                                                onChange={() => pickKind(k)}
                                                className="sr-only"
                                            />
                                            {k.label}
                                            <span className="text-xs font-normal opacity-80">
                                                {k.hint}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <InputError message={errors.kind} />
                            </fieldset>

                            <div className="grid gap-2">
                                <Label htmlFor={id('date')}>Day</Label>
                                <Input
                                    id={id('date')}
                                    type="date"
                                    required
                                    max={today}
                                    value={data.date}
                                    onChange={(e) =>
                                        setData('date', e.target.value)
                                    }
                                />
                                <InputError message={errors.date} />
                            </div>

                            <div className="grid gap-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor={id('from')}>From</Label>
                                        <Input
                                            id={id('from')}
                                            type="time"
                                            required
                                            value={data.start_time}
                                            onChange={(e) =>
                                                setData(
                                                    'start_time',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor={id('to')}>To</Label>
                                        <Input
                                            id={id('to')}
                                            type="time"
                                            required
                                            value={data.end_time}
                                            onChange={(e) =>
                                                setData(
                                                    'end_time',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                <p
                                    className="text-sm text-muted"
                                    aria-live="polite"
                                >
                                    {charged > 0
                                        ? `${duration(charged)} charged (office hours only).`
                                        : 'Pick when it started and ended.'}
                                </p>
                                <InputError
                                    message={
                                        errors.start_time ?? errors.end_time
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={id('note')}>
                                    Note (optional)
                                </Label>
                                <Input
                                    id={id('note')}
                                    maxLength={120}
                                    placeholder="e.g. Traffic, bank errand"
                                    value={data.note}
                                    onChange={(e) =>
                                        setData('note', e.target.value)
                                    }
                                />
                                <InputError message={errors.note} />
                            </div>

                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Log late
                            </Button>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Accidental taps happen on phones: removing asks first. */
export function RemoveLate({ entry, who }: { entry: LateEntry; who?: string }) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove the late on ${longDay(entry.date)}`}
                >
                    <X />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Remove this late?</DialogTitle>
                <DialogDescription>
                    {who ? `${who}: ` : ''}
                    {LATE_KINDS.find((k) => k.value === entry.kind)?.label ??
                        'Late'}{' '}
                    on {longDay(entry.date)}, {clock(entry.start_time)}–
                    {clock(entry.end_time)}. If you posted it on WIP, correct it
                    there too.
                </DialogDescription>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Keep it</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                            router.delete(
                                TimeController.destroyLate.url(entry.id),
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
