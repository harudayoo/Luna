import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { index as calendarIndex } from '@/routes/calendar';

type Holiday = { date: string; name: string; kind: 'regular' | 'special' };

type Entry = {
    date: string;
    user_id: number;
    name: string;
    days: number;
    mine: boolean;
    /** Only for your own leave, or when you're HR. */
    note: string | null;
};

type Props = {
    month: string; // Y-m
    prev: string;
    next: string;
    today: string; // Y-m-d
    holidays: Holiday[];
    leaves: Entry[];
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Dates arrive as Y-m-d; format them in UTC so the day never shifts with the time zone.
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        utc(iso),
    );
const longDay = (iso: string) =>
    fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' });
const firstName = (name: string) => name.split(' ')[0];

/** Every date of the month as Y-m-d, plus how many blank cells precede the 1st (weeks start Monday). */
function monthDays(month: string) {
    const first = utc(`${month}-01`);
    const lead = (first.getUTCDay() + 6) % 7;
    const count = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const days = Array.from(
        { length: count },
        (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    );

    return { lead, days };
}

/** The shared calendar: who's out and when the office is closed, a month at a time. */
export default function Calendar({
    month,
    prev,
    next,
    today,
    holidays,
    leaves,
}: Props) {
    const { lead, days } = monthDays(month);
    const holidayOn = new Map(holidays.map((h) => [h.date, h]));
    const leaveOn = new Map<string, Entry[]>();
    leaves.forEach((l) =>
        leaveOn.set(l.date, [...(leaveOn.get(l.date) ?? []), l]),
    );
    const [selected, setSelected] = useState(
        today.startsWith(month) ? today : days[0],
    );
    // A new month arrives with a stale selection: fall back to its first day.
    const day = selected.startsWith(month) ? selected : days[0];

    return (
        <>
            <Head title="Calendar" />
            <p className="ocs-eyebrow">Calendar</p>
            <h2 className="mb-4 text-2xl font-semibold">Who&rsquo;s out</h2>

            {/* Month switcher: big tap targets either side, as on Leave & pay. */}
            <div className="mb-4 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={calendarIndex({ query: { month: prev } })}
                        preserveScroll
                        aria-label="Previous month"
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <p className="min-w-0 flex-1 text-center font-semibold">
                    {fmt(`${month}-01`, { month: 'long', year: 'numeric' })}
                </p>
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={calendarIndex({ query: { month: next } })}
                        preserveScroll
                        aria-label="Next month"
                    >
                        <ChevronRight />
                    </Link>
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
                <div>
                    <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map((w) => (
                            <p
                                key={w}
                                className="ocs-eyebrow mb-0 text-center"
                                aria-hidden="true"
                            >
                                <span className="md:hidden">{w[0]}</span>
                                <span className="hidden md:inline">{w}</span>
                            </p>
                        ))}
                        {Array.from({ length: lead }, (_, i) => (
                            <span key={`lead-${i}`} aria-hidden="true" />
                        ))}
                        {days.map((d, i) => (
                            <DayCell
                                key={d}
                                date={d}
                                weekend={(lead + i) % 7 >= 5}
                                isToday={d === today}
                                isSelected={d === day}
                                holiday={holidayOn.get(d)}
                                entries={leaveOn.get(d) ?? []}
                                onSelect={() => setSelected(d)}
                            />
                        ))}
                    </div>
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-2 bg-accent" />
                            Holiday
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block size-2 bg-primary" />
                            People out
                        </span>
                    </p>
                </div>

                <DayPanel
                    date={day}
                    isToday={day === today}
                    holiday={holidayOn.get(day)}
                    entries={leaveOn.get(day) ?? []}
                />
            </div>
        </>
    );
}

function DayCell({
    date,
    weekend,
    isToday,
    isSelected,
    holiday,
    entries,
    onSelect,
}: {
    date: string;
    weekend: boolean;
    isToday: boolean;
    isSelected: boolean;
    holiday?: Holiday;
    entries: Entry[];
    onSelect: () => void;
}) {
    const label = [
        longDay(date),
        holiday?.name,
        entries.length > 0 &&
            `${entries.length} ${entries.length === 1 ? 'person' : 'people'} out`,
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={isSelected}
            aria-label={label}
            className={`relative flex min-h-12 flex-col items-stretch gap-1 overflow-hidden p-1 text-left md:min-h-24 md:p-2 ${
                weekend ? 'bg-bg text-muted' : 'bg-surface'
            } hover:bg-surface-hover aria-pressed:bg-surface-hover`}
        >
            {holiday && (
                <span
                    className="absolute inset-x-0 top-0 h-1 bg-accent"
                    aria-hidden="true"
                />
            )}
            <span
                className={`flex size-6 items-center justify-center text-sm font-semibold ${
                    isToday ? 'bg-primary text-on-primary' : ''
                }`}
            >
                {Number(date.slice(8))}
            </span>

            {holiday && (
                <span className="hidden truncate text-xs text-accent md:block">
                    {holiday.name}
                </span>
            )}

            {entries.length > 0 && (
                <>
                    {/* Phones: a count. Wider: up to two first names. */}
                    <span className="self-end bg-primary px-1 text-xs font-semibold text-on-primary md:hidden">
                        {entries.length}
                    </span>
                    <span className="hidden flex-col gap-0.5 md:flex">
                        {entries.slice(0, 2).map((e) => (
                            <span
                                key={e.user_id}
                                className="truncate bg-primary px-1 text-xs text-on-primary"
                            >
                                {firstName(e.name)}
                                {e.days === 0.5 && ' ½'}
                            </span>
                        ))}
                        {entries.length > 2 && (
                            <span className="text-xs text-muted">
                                +{entries.length - 2} more
                            </span>
                        )}
                    </span>
                </>
            )}
        </button>
    );
}

/** The tapped day in full: the holiday, then everyone out. */
function DayPanel({
    date,
    isToday,
    holiday,
    entries,
}: {
    date: string;
    isToday: boolean;
    holiday?: Holiday;
    entries: Entry[];
}) {
    const weekend = [0, 6].includes(utc(date).getUTCDay());

    return (
        // Gist first: on phones the day (today by default) sits above the grid; beside it from lg.
        <section
            className="ocs-card order-first lg:order-none"
            aria-live="polite"
        >
            <p className="ocs-eyebrow">{isToday ? 'Today' : 'Selected day'}</p>
            <h3 className="text-lg font-semibold">{longDay(date)}</h3>

            {holiday && (
                <p className="mt-2 font-semibold text-accent">
                    {holiday.name}
                    <span className="ml-2 text-xs font-normal text-muted">
                        {holiday.kind === 'regular'
                            ? 'Regular holiday'
                            : 'Special non-working day'}
                    </span>
                </p>
            )}

            {entries.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                    {entries.map((e) => (
                        <li key={e.user_id} className="bg-bg px-3 py-2">
                            <p className="font-semibold">
                                {e.name}
                                {e.mine && (
                                    <span className="ml-2 text-xs font-normal text-muted">
                                        (you)
                                    </span>
                                )}
                                {e.days === 0.5 && (
                                    <span className="ocs-badge ml-2">
                                        half day
                                    </span>
                                )}
                            </p>
                            {e.note && (
                                <p className="truncate text-sm text-muted">
                                    {e.note}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                !holiday && (
                    <p className="mt-2 text-sm text-muted">
                        {weekend ? 'Weekend.' : 'Everyone’s in.'}
                    </p>
                )
            )}
        </section>
    );
}

Calendar.layout = {
    breadcrumbs: [{ title: 'Calendar', href: calendarIndex() }],
};
