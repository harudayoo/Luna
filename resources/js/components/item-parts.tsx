import { router, useForm } from '@inertiajs/react';
import {
    Check,
    Copy,
    ExternalLink,
    Hourglass,
    Play,
    Square,
    Timer,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import ItemController from '@/actions/App/Http/Controllers/ItemController';
import ItemTimeController from '@/actions/App/Http/Controllers/ItemTimeController';
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
import { useClipboard } from '@/hooks/use-clipboard';

export type Status = 'queue' | 'progress' | 'hold' | 'done';
export type Scope = 'personal' | 'company';

/** A client's WIP item channel (board): "SSI · Equine Items". */
export type Channel = { id: number; label: string; url: string };

export type ItemRow = {
    id: number;
    scope: Scope;
    channel: Channel | null;
    code: string | null;
    title: string;
    status: Status;
    owner: string;
    mine: boolean;
    total_minutes: number;
};

export type Running = {
    id: number;
    item_id: number;
    title: string;
    code: string | null;
    started_at: string;
    target_minutes: number | null;
} | null;

/** The legend (Item::STATUSES), each with its token colour. */
export const STATUSES: { key: Status; label: string; dot: string }[] = [
    { key: 'queue', label: 'On Queue', dot: 'bg-muted' },
    { key: 'progress', label: 'In Progress', dot: 'bg-primary' },
    { key: 'hold', label: 'On Hold', dot: 'bg-danger' },
    { key: 'done', label: 'Done', dot: 'bg-success' },
];

/**
 * Whether a finished visit must drop every prefetched page. Item pages prefetch on hover and Inertia keeps
 * them 30 s, but after a change it only drops the current page: opening an item right after starting its
 * clock showed the old page (no clock, Start still offered).
 */
export function flushesPrefetch(visit: { method: string }): boolean {
    return visit.method !== 'get';
}

/** On the Items pages: after any change (start, stop, status, log), forget prefetched pages. */
export function useFreshItems() {
    useEffect(
        () =>
            router.on('finish', (e) => {
                if (flushesPrefetch(e.detail.visit)) {
                    router.flushAll();
                }
            }),
        [],
    );
}

/** The board: a column per status in legend order (empty ones too); a status filter keeps just its column. */
export function boardColumns<T extends { status: Status }>(
    items: T[],
    only: Status | null,
) {
    return STATUSES.filter((s) => !only || s.key === only).map((status) => ({
        status,
        items: items.filter((i) => i.status === status.key),
    }));
}

export const statusOf = (s: Status) => STATUSES.find((x) => x.key === s)!;

export function StatusBadge({ status }: { status: Status }) {
    const s = statusOf(status);

    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span aria-hidden="true" className={`size-2.5 ${s.dot}`} />
            {s.label}
        </span>
    );
}

/** Minutes as WIP takes them: 2h 35m, 45m, 2h (ItemTime::wip). */
export const wipTime = (m: number) => {
    const h = Math.floor(m / 60);

    return h === 0 ? `${m % 60}m` : m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
};

/** WIP time, or "—" when there's none yet. */
export const hm = (m: number) => (m === 0 ? '—' : wipTime(m));

/** The item's client channel as a small tag that opens its WIP board. */
export function ChannelTag({ channel }: { channel: Channel }) {
    return (
        <a
            href={channel.url}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="ocs-badge inline-flex items-center gap-1 text-ink hover:text-primary"
        >
            {channel.label}
            <ExternalLink className="size-3" aria-hidden="true" />
        </a>
    );
}

export type Logged = {
    item_id: number;
    code: string | null;
    title: string;
    minutes: number;
    wip: string;
    channel: Channel | null;
};

/**
 * After time is logged on an item with a client channel (flash `item_logged`): the time as it goes onto WIP,
 * with Copy, "Copy and open <board>" and "Open channel" (opens it without copying). Buttons, because
 * browsers block opening tabs after an async save. The row wraps: long board names don't fit one line.
 */
export function LoggedStep() {
    const [logged, setLogged] = useState<Logged | null>(null);
    const [copied, copy] = useClipboard();

    useEffect(
        () =>
            router.on('flash', (event) => {
                const data = (event as CustomEvent).detail?.flash
                    ?.item_logged as Logged | undefined;

                if (data?.channel) {
                    setLogged(data);
                }
            }),
        [],
    );

    return (
        <Dialog
            open={logged !== null}
            onOpenChange={(o) => !o && setLogged(null)}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                {logged?.channel && (
                    <>
                        <DialogTitle>Log it on WIP</DialogTitle>
                        <DialogDescription>
                            {logged.code && (
                                <span className="font-mono">
                                    {logged.code} ·{' '}
                                </span>
                            )}
                            {logged.title}
                        </DialogDescription>
                        <p className="font-mono text-5xl font-semibold">
                            {logged.wip}
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button
                                variant="secondary"
                                className="min-h-11"
                                onClick={() => void copy(logged.wip)}
                            >
                                {copied === logged.wip ? <Check /> : <Copy />}
                                {copied === logged.wip ? 'Copied' : 'Copy'}
                            </Button>
                            <Button
                                className="min-h-11 sm:grow"
                                onClick={() => {
                                    void copy(logged.wip);
                                    window.open(
                                        logged.channel!.url,
                                        '_blank',
                                        'noopener',
                                    );
                                    setLogged(null);
                                }}
                            >
                                <ExternalLink /> Copy and open{' '}
                                {logged.channel.label}
                            </Button>
                            <Button
                                variant="secondary"
                                className="min-h-11 sm:grow"
                                onClick={() => {
                                    window.open(
                                        logged.channel!.url,
                                        '_blank',
                                        'noopener',
                                    );
                                    setLogged(null);
                                }}
                            >
                                <ExternalLink /> Open channel
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Seconds as a clock: 1:02:09 or 12:09. */
export const clockOf = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
    const ss = String(s % 60).padStart(2, '0');

    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Seconds since `iso`, ticking each second. */
function useElapsed(iso: string) {
    const read = () => (Date.now() - new Date(iso).getTime()) / 1000;
    const [sec, setSec] = useState(read);

    useEffect(() => {
        const t = window.setInterval(() => setSec(read()), 1000);

        return () => window.clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iso]);

    return sec;
}

const stop = (opts: { onFinish?: () => void } = {}) =>
    router.post(
        ItemTimeController.stop.url(),
        {},
        { preserveScroll: true, ...opts },
    );

/**
 * The running clock: the stopwatch counting up, or a countdown counting down that stops itself at zero
 * (the server caps it at its target too, if the tab was closed). Big digits first: the gist.
 */
export function RunningClock({
    running,
    link,
}: {
    running: NonNullable<Running>;
    link?: ReactNode;
}) {
    const sec = useElapsed(running.started_at);
    const [busy, setBusy] = useState(false);
    const sent = useRef(false);
    const target = running.target_minutes ? running.target_minutes * 60 : null;
    const left = target !== null ? target - sec : null;

    useEffect(() => {
        if (left !== null && left <= 0 && !sent.current) {
            sent.current = true;
            // The server's toast says time's up (ItemTimeController::stop).
            navigator.vibrate?.(300);
            stop();
        }
    }, [left]);

    return (
        <section
            aria-live="polite"
            className="ocs-card mb-6 flex flex-wrap items-center gap-4"
        >
            <div className="min-w-0 flex-1">
                <p className="ocs-eyebrow mb-1 flex items-center gap-1.5">
                    {target !== null ? (
                        <Hourglass className="size-3.5" />
                    ) : (
                        <Timer className="size-3.5" />
                    )}
                    {target !== null
                        ? `Countdown · ${running.target_minutes} min`
                        : 'Stopwatch'}
                </p>
                <p className="font-mono text-4xl font-semibold tabular-nums">
                    {clockOf(left ?? sec)}
                </p>
                <p className="mt-1 truncate text-sm text-muted">
                    {running.code && (
                        <span className="font-mono">{running.code} · </span>
                    )}
                    {link ?? running.title}
                </p>
            </div>
            <Button
                variant="default"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                    setBusy(true);
                    stop({ onFinish: () => setBusy(false) });
                }}
            >
                {busy ? <Spinner /> : <Square />} Stop
            </Button>
        </section>
    );
}

const PRESETS = [15, 25, 30, 45, 60, 90];

/** Start a stopwatch on an item, or a countdown of a few minutes (a dialog, so phones get big targets). */
export function StartTime({
    itemId,
    trigger,
}: {
    itemId: number;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [minutes, setMinutes] = useState('25');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const start = (target?: number) =>
        router.post(
            ItemTimeController.start.url(itemId),
            target ? { target_minutes: target } : {},
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onSuccess: () => setOpen(false),
                onError: (e) => setError(e.target_minutes),
            },
        );

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => (setOpen(o), setError(undefined))}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>Start the clock</DialogTitle>
                <DialogDescription>
                    One clock runs at a time: starting this stops any other.
                </DialogDescription>
                <Button
                    className="min-h-12"
                    disabled={busy}
                    onClick={() => start()}
                >
                    {busy ? <Spinner /> : <Play />} Stopwatch
                </Button>
                <div className="grid gap-2">
                    <p className="text-sm font-medium">Or a countdown</p>
                    <div className="grid grid-cols-3 gap-2">
                        {PRESETS.map((m) => (
                            <Button
                                key={m}
                                variant="secondary"
                                className="min-h-11"
                                disabled={busy}
                                onClick={() => start(m)}
                            >
                                {m} min
                            </Button>
                        ))}
                    </div>
                    <form
                        className="flex items-end gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            start(Number(minutes));
                        }}
                    >
                        <div className="grid flex-1 gap-1">
                            <Label htmlFor={`countdown-${itemId}`}>
                                Minutes
                            </Label>
                            <Input
                                id={`countdown-${itemId}`}
                                inputMode="numeric"
                                type="number"
                                min={1}
                                max={600}
                                value={minutes}
                                onChange={(e) => setMinutes(e.target.value)}
                                className="text-base md:text-sm"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            className="min-h-11"
                            disabled={busy}
                        >
                            <Hourglass /> Start
                        </Button>
                    </form>
                    <InputError message={error} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Add an item, or edit one you can edit. Personal: only you. Company: everyone sees and moves it. */
export function ItemDialog({
    item,
    channels,
    trigger,
}: {
    item?: ItemRow & { notes: string | null };
    channels: Channel[];
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        scope: item?.scope ?? ('personal' as Scope),
        channel_id: item?.channel?.id ? String(item.channel.id) : '',
        code: item?.code ?? '',
        title: item?.title ?? '',
        notes: item?.notes ?? '',
    });
    const { data, setData, errors, processing } = form;
    const id = (f: string) => `item-${item?.id ?? 'new'}-${f}`;

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>{item ? 'Edit item' : 'New item'}</DialogTitle>
                <DialogDescription>
                    {data.scope === 'company'
                        ? 'Company: everyone sees it, moves its status and logs time on it.'
                        : 'Personal: only you see it.'}
                </DialogDescription>
                <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.submit(
                            item
                                ? ItemController.update(item.id)
                                : ItemController.store(),
                            {
                                preserveScroll: true,
                                onSuccess: () => {
                                    setOpen(false);
                                    if (!item) {
                                        form.reset();
                                    }
                                },
                            },
                        );
                    }}
                >
                    <fieldset className="grid gap-2">
                        <legend className="mb-2 text-sm font-medium">
                            Kind
                        </legend>
                        <div className="grid grid-cols-2 gap-1 bg-surface-hover p-1">
                            {(['personal', 'company'] as const).map((s) => (
                                <label
                                    key={s}
                                    className="flex min-h-11 cursor-pointer items-center justify-center px-2 text-sm font-semibold text-muted capitalize has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:shadow-lift"
                                >
                                    <input
                                        type="radio"
                                        name={id('scope')}
                                        value={s}
                                        checked={data.scope === s}
                                        onChange={() => setData('scope', s)}
                                        className="sr-only"
                                    />
                                    {s}
                                </label>
                            ))}
                        </div>
                        <InputError message={errors.scope} />
                    </fieldset>
                    <div className="grid gap-2">
                        <Label htmlFor={id('title')}>Title</Label>
                        <Input
                            id={id('title')}
                            value={data.title}
                            maxLength={160}
                            required
                            onChange={(e) => setData('title', e.target.value)}
                            className="text-base md:text-sm"
                        />
                        <InputError message={errors.title} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={id('channel')}>
                            Client channel (optional)
                        </Label>
                        <select
                            id={id('channel')}
                            value={data.channel_id}
                            onChange={(e) =>
                                setData('channel_id', e.target.value)
                            }
                            className="h-10 w-full rounded-sm bg-surface-hover px-3 text-base text-ink outline-none focus-visible:bg-surface focus-visible:shadow-lift md:text-sm"
                        >
                            <option value="">None</option>
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.channel_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={id('code')}>
                            Ticket no. (optional)
                        </Label>
                        <Input
                            id={id('code')}
                            value={data.code}
                            maxLength={40}
                            onChange={(e) => setData('code', e.target.value)}
                            className="font-mono text-base md:text-sm"
                        />
                        <InputError message={errors.code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={id('notes')}>Notes (optional)</Label>
                        <textarea
                            id={id('notes')}
                            rows={3}
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            className="w-full rounded-sm bg-surface-hover px-3 py-2 text-base text-ink transition-[background-color,box-shadow] duration-(--dur-fast) outline-none placeholder:text-muted focus-visible:bg-surface focus-visible:shadow-lift md:text-sm"
                        />
                        <InputError message={errors.notes} />
                    </div>
                    <Button className="min-h-11" disabled={processing}>
                        {processing && <Spinner />}
                        {item ? 'Save' : 'Add to On Queue'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
