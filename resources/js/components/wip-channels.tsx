import { ArrowUpRight, Hash, Megaphone, Pencil, Plus } from 'lucide-react';
import type { WipTile } from '@/components/wip-tile-dialog';
import { WipTileDialog } from '@/components/wip-tile-dialog';
import { ocsRef } from '@/lib/ocs';

export type WipChannel = {
    key: string;
    name: string;
    server: string;
    about: string;
    url: string;
};

/**
 * WIP, the office's main channel to other offices, teams and clients (the boss's rule: talk there first).
 * Each channel is a card that opens WIP in a new tab: picked up like paper in the light theme, tilted under a
 * spotlight in the dark one. Attendance gets the accent: it's where lates are posted. Under the office's
 * channels, each person pins up to `max` of their own, then up to `max` of any other link (only they see them).
 */
export function WipChannels({
    channels,
    mine = [],
    links = [],
    max = 4,
    tags,
}: {
    /** Tag presets for pinned tiles (OCS and the client companies). */
    tags?: string[];
    channels: WipChannel[];
    /** The channels this person pinned. */
    mine?: WipTile[];
    /** The other links this person pinned (any web address), a row of their own. */
    links?: WipTile[];
    /** Tiles of each kind one person can pin. */
    max?: number;
}) {
    return (
        <section aria-labelledby="wip-title" className="mb-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="wip-title" className="ocs-eyebrow mb-0">
                    WIP · talk to the office there first
                </h3>
                <span className="ocs-code text-xs text-muted">
                    wip.quicksilversystems.com
                </span>
            </div>
            {/* The boss's standing reminder, for everyone. A solid shade, no border (kit rule). */}
            <p
                role="note"
                className="mb-3 flex gap-3 bg-surface p-4 text-sm text-ink"
            >
                <Megaphone
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-primary"
                />
                <span>
                    <strong className="font-semibold">
                        Reminder: always use WIP.
                    </strong>{' '}
                    It&rsquo;s our primary channel for talking to other offices,
                    teams and clients, and for internal matters. If it&rsquo;s
                    worth saying, say it on WIP.
                </span>
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                {channels.map((c) => (
                    <li key={c.key}>
                        <ChannelLink
                            tag={c.server}
                            name={c.name}
                            about={c.about}
                            url={c.url}
                            highlight={c.key === 'attendance'}
                        />
                    </li>
                ))}
            </ul>

            <PinnedRow kind="wip" tiles={mine} max={max} tags={tags} />
            <PinnedRow kind="link" tiles={links} max={max} tags={tags} />
        </section>
    );
}

/** One row of a person's own pinned tiles (WIP channels or links), with a Pin tile while there's room. */
function PinnedRow({
    kind,
    tiles,
    max,
    tags,
}: {
    kind: WipTile['kind'];
    tiles: WipTile[];
    max: number;
    tags?: string[];
}) {
    const isLink = kind === 'link';

    return (
        <>
            <div className="mt-6 mb-3 flex items-baseline justify-between gap-4">
                <h4 className="ocs-eyebrow mb-0">
                    {isLink ? 'Your links' : 'Your channels'}
                </h4>
                <span className="text-xs text-muted">
                    {tiles.length} of {max} pinned
                </span>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                {tiles.map((t) => (
                    <li key={t.id} className="relative">
                        <ChannelLink
                            tag={t.tag}
                            name={t.name}
                            about={t.about}
                            url={t.url}
                            link={isLink}
                            editable
                        />
                        {/* A sibling of the link, never inside it: a button in a link is invalid HTML. */}
                        <WipTileDialog
                            tile={t}
                            tags={tags}
                            trigger={
                                <button
                                    type="button"
                                    aria-label={`Edit ${isLink ? t.name : `#${t.name}`}`}
                                    className="absolute top-1 right-1 z-10 grid size-10 place-items-center text-muted hover:text-ink focus-visible:shadow-lift focus-visible:outline-none"
                                >
                                    <Pencil aria-hidden className="size-4" />
                                </button>
                            }
                        />
                    </li>
                ))}
                {tiles.length < max && (
                    <li>
                        <WipTileDialog
                            kind={kind}
                            tags={tags}
                            trigger={
                                <button
                                    type="button"
                                    className="ocs-card ocs-card-link flex h-full min-h-24 w-full flex-col items-start justify-center gap-1 text-left sm:min-h-28"
                                >
                                    <span className="flex items-center gap-2 text-sm font-semibold text-primary sm:text-base">
                                        <Plus aria-hidden className="size-5" />
                                        {isLink
                                            ? 'Pin a link'
                                            : 'Pin a channel'}
                                    </span>
                                    <span className="text-xs text-muted sm:text-sm">
                                        {tiles.length > 0
                                            ? `${max - tiles.length} more you can pin.`
                                            : isLink
                                              ? 'Any page you open often, one tap away.'
                                              : 'Your team’s or a client’s, one tap away.'}
                                    </span>
                                </button>
                            }
                        />
                    </li>
                )}
            </ul>
        </>
    );
}

/** The address's host ("acme.atlassian.net"), shown on a link tile that has no description. */
function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/**
 * One tile, opening WIP (or, for a pinned link, its page) in a new tab. A pinned one leaves its top-right
 * corner to its Edit button.
 */
function ChannelLink({
    tag,
    name,
    about,
    url,
    highlight = false,
    editable = false,
    link = false,
}: {
    tag: string;
    name: string;
    about: string | null;
    url: string;
    highlight?: boolean;
    editable?: boolean;
    /** Any web link rather than a WIP channel: no `#`, and the host stands in for a missing description. */
    link?: boolean;
}) {
    const detail = about ?? (link ? hostOf(url) : null);

    return (
        <a
            ref={ocsRef(['tilt'])}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-ocs="tilt"
            className={`ocs-card group flex h-full flex-col gap-2 sm:min-h-28 ${
                highlight ? 'bg-accent text-on-accent hover:bg-accent' : ''
            }`}
        >
            <span
                className={`flex items-center justify-between gap-2 ${editable ? 'pr-8' : ''}`}
            >
                <span
                    className={`ocs-badge ${highlight ? 'text-ink' : ''}`}
                    aria-label={`${tag} tag`}
                >
                    {tag}
                </span>
                {!editable && (
                    <ArrowUpRight
                        aria-hidden
                        className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                    />
                )}
            </span>
            <span
                className={`flex min-w-0 items-center gap-1 text-sm font-semibold sm:text-lg ${link ? '' : 'font-mono'}`}
            >
                {!link && (
                    <Hash aria-hidden className="size-4 shrink-0 opacity-70" />
                )}
                <span className="break-all">{name}</span>
            </span>
            {detail && (
                <span
                    className={`hidden text-sm sm:block ${about ? '' : 'break-all'} ${highlight ? '' : 'text-muted'}`}
                >
                    {detail}
                </span>
            )}
            <span className="sr-only">
                {link ? '(opens in a new tab)' : '(opens WIP in a new tab)'}
            </span>
        </a>
    );
}
