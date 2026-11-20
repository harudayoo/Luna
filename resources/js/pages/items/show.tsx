import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Hourglass, Pencil, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ItemController from '@/actions/App/Http/Controllers/ItemController';
import ItemTimeController from '@/actions/App/Http/Controllers/ItemTimeController';
import InputError from '@/components/input-error';
import type {
    Channel,
    ItemRow,
    Running,
    Status,
} from '@/components/item-parts';
import {
    hm,
    ChannelTag,
    ItemDialog,
    LoggedStep,
    RunningClock,
    STATUSES,
    StartTime,
    useFreshItems,
} from '@/components/item-parts';
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
import { officeHm, useOfficeClock } from '@/lib/office-clock';
import { index as itemsIndex, show as itemShow } from '@/routes/items';

type Entry = {
    id: number;
    who: string;
    mine: boolean;
    started_at: string;
    ended_at: string | null;
    minutes: number;
    countdown: boolean;
};

type Props = {
    item: ItemRow & {
        notes: string | null;
        my_minutes: number;
        can_edit: boolean;
    };
    times: Entry[];
    running: Running;
    channels: Channel[];
    today: string;
};

const office = (iso: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...o }).format(
        new Date(iso),
    );
const at = (iso: string) => office(iso, { hour: 'numeric', minute: '2-digit' });

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** One item: its status, the clock, a start-end calculator to log time by hand, and everyone's entries. */
export default function ItemShow({
    item,
    times,
    running,
    today,
    channels,
}: Props) {
    const runningHere = running?.item_id === item.id;
    useFreshItems();

    return (
        <>
            <Head title={item.title} />
            <LoggedStep />
            <Link
                href={itemsIndex.url()}
                className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
            >
                <ArrowLeft className="size-4" /> Items
            </Link>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="ocs-eyebrow">
                        {item.scope === 'company'
                            ? `Company · ${item.mine ? 'yours' : item.owner}`
                            : 'Personal'}
                        {item.code && (
                            <span className="ml-2 font-mono normal-case">
                                {item.code}
                            </span>
                        )}
                    </p>
                    <h2 className="text-2xl font-semibold break-words">
                        {item.title}
                    </h2>
                    {item.channel && (
                        <p className="mt-2">
                            <ChannelTag channel={item.channel} />
                        </p>
                    )}
                </div>
                {item.can_edit && (
                    <div className="flex gap-2">
                        <ItemDialog
                            channels={channels}
                            item={item}
                            trigger={
                                <Button
                                    variant="secondary"
                                    className="min-h-11 bg-surface"
                                >
                                    <Pencil /> Edit
                                </Button>
                            }
                        />
                        <DeleteItem id={item.id} title={item.title} />
                    </div>
                )}
            </div>

            <StatusPicker id={item.id} status={item.status} />

            {runningHere && <RunningClock running={running!} />}
            {
                <section className="ocs-card mb-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="ocs-eyebrow mb-1">Total</p>
                            <p className="font-mono text-2xl font-semibold">
                                {hm(item.total_minutes)}
                            </p>
                        </div>
                        <div>
                            <p className="ocs-eyebrow mb-1">Yours</p>
                            <p className="font-mono text-2xl font-semibold">
                                {hm(item.my_minutes)}
                            </p>
                        </div>
                    </div>
                    {!runningHere && (
                        <div className="grid gap-2">
                            <StartTime
                                itemId={item.id}
                                trigger={
                                    <Button className="min-h-11">
                                        <Play /> Start the clock
                                    </Button>
                                }
                            />
                            {running && (
                                <p className="text-xs text-muted">
                                    Running now on{' '}
                                    <Link
                                        href={itemShow.url(running.item_id)}
                                        className="text-ink underline underline-offset-4"
                                    >
                                        {running.title}
                                    </Link>
                                    ; starting here stops it.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            }

            <div className="ocs-grid mb-8 lg:grid-cols-2">
                <LogTime id={item.id} today={today} />
                {item.notes && (
                    <section className="ocs-card">
                        <p className="ocs-eyebrow">Notes</p>
                        <p className="text-sm whitespace-pre-line">
                            {item.notes}
                        </p>
                    </section>
                )}
            </div>

            <section className="mb-6">
                <h3 className="ocs-eyebrow mb-3">Time entries</h3>
                {times.length === 0 ? (
                    <p className="bg-surface p-4 text-sm text-muted">
                        No time on this item yet.
                    </p>
                ) : (
                    <ul className="grid gap-2">
                        {times.map((t) => (
                            <li
                                key={t.id}
                                className="flex min-h-14 items-center gap-3 bg-surface py-2 pr-2 pl-4"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">
                                        {office(t.started_at, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                        <span className="ml-2 font-mono text-sm">
                                            {t.ended_at
                                                ? hm(t.minutes)
                                                : 'running'}
                                        </span>
                                    </p>
                                    <p className="truncate text-sm text-muted">
                                        <span className="font-mono">
                                            {at(t.started_at)}–
                                            {t.ended_at ? at(t.ended_at) : '…'}
                                        </span>
                                        {' · '}
                                        {t.mine ? 'you' : t.who}
                                        {t.countdown && ' · countdown'}
                                    </p>
                                </div>
                                {t.mine && t.ended_at && (
                                    <RemoveEntry id={t.id} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

function StatusPicker({ id, status }: { id: number; status: Status }) {
    const [busy, setBusy] = useState<Status | null>(null);

    return (
        <fieldset className="mb-6">
            <legend className="ocs-eyebrow mb-2">Status</legend>
            <div className="grid grid-cols-2 gap-1 bg-surface p-1 sm:grid-cols-4">
                {STATUSES.map((s) => (
                    <button
                        key={s.key}
                        type="button"
                        aria-pressed={status === s.key}
                        disabled={busy !== null}
                        onClick={() =>
                            status !== s.key &&
                            router.patch(
                                ItemController.status.url(id),
                                { status: s.key },
                                {
                                    preserveScroll: true,
                                    onStart: () => setBusy(s.key),
                                    onFinish: () => setBusy(null),
                                },
                            )
                        }
                        className="flex min-h-11 items-center justify-center gap-2 px-2 text-sm font-semibold text-muted aria-pressed:bg-surface-hover aria-pressed:text-ink aria-pressed:shadow-lift"
                    >
                        {busy === s.key ? (
                            <Spinner />
                        ) : (
                            <span
                                aria-hidden="true"
                                className={`size-2.5 ${s.dot}`}
                            />
                        )}
                        {s.label}
                    </button>
                ))}
            </div>
        </fieldset>
    );
}

/** The time calculator: a start and an end (office time) give the duration as you type, then log it. */
function LogTime({ id, today }: { id: number; today: string }) {
    const form = useForm(`log-time-${id}`, { date: today, start: '', end: '' });
    const { data, setData, errors, processing } = form;
    const span =
        data.start && data.end && data.end > data.start
            ? mins(data.end) - mins(data.start)
            : 0;
    const field = (f: string) => `log-time-${id}-${f}`;
    const now = useOfficeClock(true);

    return (
        <section className="ocs-card">
            {/* The time now (office time), live, so a start or an end can be read off it. */}
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="ocs-eyebrow">Log time by hand</p>
                <p className="text-sm">
                    Now{' '}
                    <time className="font-mono text-base font-semibold text-ink tabular-nums">
                        {now}
                    </time>
                </p>
            </div>
            <form
                className="grid gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(ItemTimeController.store(id), {
                        preserveScroll: true,
                        onSuccess: () => form.reset('start', 'end'),
                    });
                }}
            >
                <div className="grid gap-1">
                    <Label htmlFor={field('date')}>Date</Label>
                    <Input
                        id={field('date')}
                        type="date"
                        max={today}
                        value={data.date}
                        required
                        onChange={(e) => setData('date', e.target.value)}
                        className="text-base md:text-sm"
                    />
                    <InputError message={errors.date} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                        <NowLabel
                            htmlFor={field('start')}
                            label="Start"
                            onNow={() => setData('start', officeHm(new Date()))}
                        />
                        <Input
                            id={field('start')}
                            type="time"
                            value={data.start}
                            required
                            onChange={(e) => setData('start', e.target.value)}
                            className="text-base md:text-sm"
                        />
                        <InputError message={errors.start} />
                    </div>
                    <div className="grid gap-1">
                        <NowLabel
                            htmlFor={field('end')}
                            label="End"
                            onNow={() => setData('end', officeHm(new Date()))}
                        />
                        <Input
                            id={field('end')}
                            type="time"
                            value={data.end}
                            required
                            onChange={(e) => setData('end', e.target.value)}
                            className="text-base md:text-sm"
                        />
                        <InputError message={errors.end} />
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p aria-live="polite" className="text-sm text-muted">
                        <Hourglass className="mr-1 inline size-4 align-[-3px]" />
                        {span > 0 ? (
                            <span className="font-mono font-semibold text-ink">
                                {hm(span)}
                            </span>
                        ) : (
                            'Pick a start and an end'
                        )}
                    </p>
                    <Button
                        variant="secondary"
                        className="min-h-11 bg-bg"
                        disabled={processing || span === 0}
                    >
                        {processing && <Spinner />} Log it
                    </Button>
                </div>
            </form>
        </section>
    );
}

/** A Start or End label with "Now" at its right: one tap fills the field with the office time. */
function NowLabel({
    htmlFor,
    label,
    onNow,
}: {
    htmlFor: string;
    label: string;
    onNow: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {/* Tall enough to tap, without pushing the row down. */}
            <button
                type="button"
                onClick={onNow}
                aria-label={`Set ${label.toLowerCase()} to now`}
                className="-my-3 min-h-10 px-2 text-sm font-semibold text-primary hover:underline focus-visible:shadow-lift focus-visible:outline-none"
            >
                Now
            </button>
        </div>
    );
}

function RemoveEntry({ id }: { id: number }) {
    const [sure, setSure] = useState(false);
    const [busy, setBusy] = useState(false);

    return sure ? (
        <div className="flex gap-1">
            <Button
                variant="secondary"
                size="sm"
                className="min-h-10 bg-bg"
                onClick={() => setSure(false)}
            >
                Keep
            </Button>
            <Button
                variant="destructive"
                size="sm"
                className="min-h-10"
                disabled={busy}
                onClick={() =>
                    router.delete(ItemTimeController.destroy.url(id), {
                        preserveScroll: true,
                        onStart: () => setBusy(true),
                        onFinish: () => setBusy(false),
                    })
                }
            >
                {busy && <Spinner />} Remove
            </Button>
        </div>
    ) : (
        <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Remove this entry"
            onClick={() => setSure(true)}
        >
            <Trash2 />
        </Button>
    );
}

function DeleteItem({ id, title }: { id: number; title: string }) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="secondary"
                    size="icon"
                    className="size-11 bg-surface"
                    aria-label="Delete item"
                >
                    <Trash2 />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Delete “{title}”?</DialogTitle>
                <DialogDescription>
                    Its time entries go with it, everyone’s. This can’t be
                    undone.
                </DialogDescription>
                <Button
                    variant="destructive"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() =>
                        router.delete(ItemController.destroy.url(id), {
                            onStart: () => setBusy(true),
                            onFinish: () => setBusy(false),
                        })
                    }
                >
                    {busy && <Spinner />} Delete item
                </Button>
            </DialogContent>
        </Dialog>
    );
}

ItemShow.layout = {
    breadcrumbs: [{ title: 'Items', href: itemsIndex() }],
};
