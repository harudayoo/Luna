import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import TimeController from '@/actions/App/Http/Controllers/TimeController';
import { clock, LogLateDialog } from '@/components/log-late-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export type Step = 'time_in' | 'lunch_start' | 'lunch_end' | 'time_out';

export type Today = {
    date: string;
    time_in: string | null;
    lunch_start: string | null;
    lunch_end: string | null;
    time_out: string | null;
    next: Step | null;
    can_skip_lunch: boolean;
};

const STEPS: { key: Step; label: string; action: string }[] = [
    { key: 'time_in', label: 'Time in', action: 'Time in' },
    { key: 'lunch_start', label: 'Lunch start', action: 'Start lunch' },
    { key: 'lunch_end', label: 'Lunch end', action: 'Back from lunch' },
    { key: 'time_out', label: 'Time out', action: 'Time out' },
];

/** The office clock (Asia/Manila), ticking each 15 s: stamps use the server's time, this is a guide. */
function useOfficeClock() {
    const read = () =>
        new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date());
    const [now, setNow] = useState(read);

    useEffect(() => {
        const t = window.setInterval(() => setNow(read()), 15000);

        return () => window.clearInterval(t);
    }, []);

    return now;
}

/**
 * Today's four stamps with one big button for the next one (one tap, server time). A record only: lates are
 * charged from what people declare, so "Log a late" sits right beside it.
 */
export function TimeToday({ today, wipUrl }: { today: Today; wipUrl: string }) {
    const [busy, setBusy] = useState<Step | null>(null);
    const now = useOfficeClock();
    const next = STEPS.find((s) => s.key === today.next);

    const stamp = (step: Step) =>
        router.post(
            TimeController.stamp.url(),
            { step },
            {
                preserveScroll: true,
                onStart: () => setBusy(step),
                onFinish: () => setBusy(null),
            },
        );

    return (
        <section className="ocs-card" aria-labelledby="today-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="ocs-eyebrow">
                        Time{' '}
                        <span className="ocs-badge ocs-badge-accent ml-1">
                            new
                        </span>
                    </p>
                    <h3 id="today-title" className="mb-0">
                        {today.next === null
                            ? 'Done for today'
                            : today.next === 'time_in'
                              ? 'Not in yet'
                              : today.next === 'lunch_end'
                                ? 'On lunch'
                                : 'At work'}
                    </h3>
                </div>
                <p
                    className="font-mono text-2xl font-semibold text-ink tabular-nums"
                    aria-label={`Office time ${now}`}
                >
                    {now}
                </p>
            </div>

            {/* The four stamps: 2 x 2 on phones, a row from sm. */}
            <ol className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-4">
                {STEPS.map((s) => {
                    const t = today[s.key];

                    return (
                        <li
                            key={s.key}
                            aria-current={
                                today.next === s.key ? 'step' : undefined
                            }
                            className="bg-bg p-3 aria-[current=step]:bg-surface-hover"
                        >
                            <p className="text-xs font-semibold text-muted">
                                {s.label}
                            </p>
                            <p
                                className={`font-mono text-lg tabular-nums ${t ? 'text-ink' : 'text-muted'}`}
                            >
                                {t ? clock(t) : '––:––'}
                            </p>
                        </li>
                    );
                })}
            </ol>

            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                {next && (
                    <Button
                        className="min-h-12 w-full sm:w-auto"
                        disabled={busy !== null}
                        onClick={() => stamp(next.key)}
                    >
                        {busy === next.key && <Spinner />}
                        {next.action}
                    </Button>
                )}
                {today.can_skip_lunch && today.next === 'lunch_start' && (
                    <Button
                        variant="secondary"
                        className="min-h-12 w-full bg-bg sm:w-auto"
                        disabled={busy !== null}
                        onClick={() => stamp('time_out')}
                    >
                        {busy === 'time_out' && <Spinner />}
                        Time out (no lunch)
                    </Button>
                )}
                <LogLateDialog
                    action={TimeController.storeLate()}
                    today={today.date}
                    wipUrl={wipUrl}
                    trigger={
                        <Button
                            variant="secondary"
                            className="min-h-12 w-full bg-bg sm:w-auto"
                        >
                            Log a late
                        </Button>
                    }
                />
            </div>
            <p className="mt-3 text-sm text-muted">
                Stamps are your record. Lates are charged only from what you log
                here and post on WIP.
            </p>
        </section>
    );
}
