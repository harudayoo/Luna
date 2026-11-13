import { ArrowUpRight, Hash, Megaphone } from 'lucide-react';
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
 * spotlight in the dark one. Attendance gets the accent: it's where lates are posted.
 */
export function WipChannels({ channels }: { channels: WipChannel[] }) {
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
                {channels.map((c) => {
                    const highlight = c.key === 'attendance';

                    return (
                        <li key={c.key}>
                            <a
                                ref={ocsRef(['tilt'])}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-ocs="tilt"
                                className={`ocs-card group flex h-full flex-col gap-2 sm:min-h-28 ${
                                    highlight
                                        ? 'bg-accent text-on-accent hover:bg-accent'
                                        : ''
                                }`}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span
                                        className={`ocs-badge ${highlight ? 'text-ink' : ''}`}
                                        aria-label={`${c.server} server`}
                                    >
                                        {c.server}
                                    </span>
                                    <ArrowUpRight
                                        aria-hidden
                                        className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                                    />
                                </span>
                                <span className="flex min-w-0 items-center gap-1 font-mono text-sm font-semibold sm:text-lg">
                                    <Hash
                                        aria-hidden
                                        className="size-4 shrink-0 opacity-70"
                                    />
                                    <span className="break-all">{c.name}</span>
                                </span>
                                <span
                                    className={`hidden text-sm sm:block ${highlight ? '' : 'text-muted'}`}
                                >
                                    {c.about}
                                </span>
                                <span className="sr-only">
                                    (opens WIP in a new tab)
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
