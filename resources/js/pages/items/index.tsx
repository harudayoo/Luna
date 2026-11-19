import { Head, Link, router } from '@inertiajs/react';
import { Columns3, List, Play, Plus, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import ItemTimeController from '@/actions/App/Http/Controllers/ItemTimeController';
import type {
    Channel,
    ItemRow,
    Running,
    Scope,
    Status,
} from '@/components/item-parts';
import {
    boardColumns,
    hm,
    ItemDialog,
    LoggedStep,
    RunningClock,
    STATUSES,
    StartTime,
    StatusBadge,
    useFreshItems,
} from '@/components/item-parts';
import { Button } from '@/components/ui/button';
import { index as itemsIndex, show as itemShow } from '@/routes/items';

type Props = {
    items: ItemRow[];
    counts: Record<Status, number>;
    filters: { scope: Scope | null; status: Status | null };
    running: Running;
    channels: Channel[];
};

type View = 'list' | 'board';

const SCOPES: { key: Scope | null; label: string }[] = [
    { key: null, label: 'All' },
    { key: 'personal', label: 'Personal' },
    { key: 'company', label: 'Company' },
];

const VIEW_KEY = 'luna-items-view';

/**
 * Items: the vault of work items (yours and the company's) by status, with the time on each, as a list or
 * a board (a column per status). The running clock sits on top, so what you're timing is seen first.
 */
export default function Items({
    items,
    counts,
    filters,
    running,
    channels,
}: Props) {
    const [view, setView] = useState<View>('list');
    useFreshItems();

    useEffect(() => {
        if (localStorage.getItem(VIEW_KEY) === 'board') {
            setView('board');
        }
    }, []);

    const pick = (v: View) => {
        setView(v);
        localStorage.setItem(VIEW_KEY, v);
    };
    const go = (next: Partial<Props['filters']>) =>
        router.get(
            itemsIndex.url(),
            Object.fromEntries(
                Object.entries({ ...filters, ...next }).filter(([, v]) => v),
            ),
            { preserveScroll: true, preserveState: true, replace: true },
        );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <>
            <Head title="Items" />
            <LoggedStep />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="ocs-eyebrow">Items</p>
                    <h2 className="text-2xl font-semibold">Item vault</h2>
                </div>
                <ItemDialog
                    channels={channels}
                    trigger={
                        <Button className="min-h-11">
                            <Plus /> New item
                        </Button>
                    }
                />
            </div>

            {running && (
                <RunningClock
                    running={running}
                    link={
                        <Link
                            href={itemShow.url(running.item_id)}
                            className="text-ink underline-offset-4 hover:underline"
                        >
                            {running.title}
                        </Link>
                    }
                />
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="grid flex-1 grid-cols-3 gap-1 bg-surface p-1 sm:flex-none">
                    {SCOPES.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            aria-pressed={filters.scope === s.key}
                            onClick={() => go({ scope: s.key })}
                            className="min-h-10 px-4 text-sm font-semibold text-muted aria-pressed:bg-primary aria-pressed:text-on-primary"
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <div
                    role="group"
                    aria-label="View"
                    className="grid grid-cols-2 gap-1 bg-surface p-1"
                >
                    {(
                        [
                            ['list', 'List', List],
                            ['board', 'Board', Columns3],
                        ] as const
                    ).map(([v, label, Icon]) => (
                        <button
                            key={v}
                            type="button"
                            aria-pressed={view === v}
                            aria-label={`${label} view`}
                            onClick={() => pick(v)}
                            className="flex size-10 items-center justify-center text-muted aria-pressed:bg-surface-hover aria-pressed:text-ink aria-pressed:shadow-lift sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:font-semibold"
                        >
                            <Icon className="size-4" />
                            <span className="sr-only sm:not-sr-only">
                                {label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <nav
                aria-label="Status"
                className="mb-4 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            >
                <Chip
                    on={filters.status === null}
                    onClick={() => go({ status: null })}
                    label="All"
                    count={total}
                />
                {STATUSES.map((s) => (
                    <Chip
                        key={s.key}
                        on={filters.status === s.key}
                        onClick={() => go({ status: s.key })}
                        label={s.label}
                        count={counts[s.key]}
                        dot={s.dot}
                    />
                ))}
            </nav>

            {total === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    No items yet. Add one with New item.
                </p>
            ) : view === 'board' ? (
                <Board items={items} only={filters.status} running={running} />
            ) : items.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    Nothing here with this status.
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-2">
                    {items.map((i) => (
                        <li
                            key={i.id}
                            className="flex min-h-16 items-center gap-2 bg-surface py-2 pr-2 pl-4"
                        >
                            <ItemLink item={i} />
                            <ClockButton item={i} running={running} />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/**
 * The board: a column per status. Phones swipe between columns (one ~85% wide, snapping), so the page
 * itself never scrolls sideways; lg+ shows all four. One status filtered: its tiles in a grid.
 */
function Board({
    items,
    only,
    running,
}: {
    items: ItemRow[];
    only: Status | null;
    running: Running;
}) {
    const columns = boardColumns(items, only);

    if (only) {
        const [col] = columns;

        return col.items.length === 0 ? (
            <p className="bg-surface p-4 text-sm text-muted">
                Nothing {col.status.label}.
            </p>
        ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {col.items.map((i) => (
                    <Tile key={i.id} item={i} running={running} />
                ))}
            </ul>
        );
    }

    return (
        <div className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {columns.map(({ status, items: colItems }) => (
                <section
                    key={status.key}
                    aria-label={status.label}
                    className="w-[85%] max-w-sm shrink-0 snap-start bg-surface p-2 sm:w-[45%] lg:w-auto lg:max-w-none"
                >
                    <h3 className="mb-2 flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
                        <span
                            aria-hidden="true"
                            className={`size-2.5 ${status.dot}`}
                        />
                        {status.label}
                        <span className="ml-auto font-mono text-xs text-muted">
                            {colItems.length}
                        </span>
                    </h3>
                    {colItems.length === 0 ? (
                        <p className="px-2 pb-2 text-sm text-muted">None.</p>
                    ) : (
                        <ul className="grid grid-cols-1 gap-2">
                            {colItems.map((i) => (
                                <Tile key={i.id} item={i} running={running} />
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}

function Tile({ item, running }: { item: ItemRow; running: Running }) {
    return (
        <li className="flex min-h-16 items-center gap-2 bg-bg py-2 pr-2 pl-3">
            <ItemLink item={item} />
            <ClockButton item={item} running={running} />
        </li>
    );
}

function ItemLink({ item: i }: { item: ItemRow }) {
    return (
        <Link
            href={itemShow.url(i.id)}
            prefetch
            className="min-w-0 flex-1 py-1"
        >
            <p className="truncate font-semibold">
                {i.code && (
                    <span className="mr-2 font-mono text-sm text-muted">
                        {i.code}
                    </span>
                )}
                {i.title}
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <StatusBadge status={i.status} />
                <span className="font-mono">{hm(i.total_minutes)}</span>
                {i.channel && (
                    <span className="ocs-badge text-ink">
                        {i.channel.label}
                    </span>
                )}
                <span className="text-xs">
                    {i.scope === 'company'
                        ? `Company · ${i.mine ? 'you' : i.owner}`
                        : 'Personal'}
                </span>
            </p>
        </Link>
    );
}

/** Stop the clock if it runs on this item, else start it (not on Done items). */
function ClockButton({
    item: i,
    running,
}: {
    item: ItemRow;
    running: Running;
}) {
    if (running?.item_id === i.id) {
        return (
            <Button
                variant="secondary"
                size="icon"
                className="size-11 bg-surface-hover"
                aria-label={`Stop the clock on ${i.title}`}
                onClick={() =>
                    router.post(
                        ItemTimeController.stop.url(),
                        {},
                        { preserveScroll: true },
                    )
                }
            >
                <Square />
            </Button>
        );
    }

    return i.status === 'done' ? null : (
        <StartTime
            itemId={i.id}
            trigger={
                <Button
                    variant="secondary"
                    size="icon"
                    className="size-11 bg-surface-hover"
                    aria-label={`Start the clock on ${i.title}`}
                >
                    <Play />
                </Button>
            }
        />
    );
}

function Chip({
    on,
    onClick,
    label,
    count,
    dot,
}: {
    on: boolean;
    onClick: () => void;
    label: string;
    count: number;
    dot?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            className="flex min-h-10 shrink-0 items-center gap-2 bg-surface px-3 text-sm font-semibold text-muted hover:bg-surface-hover aria-pressed:bg-surface-hover aria-pressed:text-ink aria-pressed:shadow-lift"
        >
            {dot && <span aria-hidden="true" className={`size-2.5 ${dot}`} />}
            {label}
            <span className="font-mono text-xs">{count}</span>
        </button>
    );
}

Items.layout = {
    breadcrumbs: [{ title: 'Items', href: itemsIndex() }],
};
