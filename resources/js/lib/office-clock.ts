import { useEffect, useState } from 'react';

/** The office time (Asia/Manila) of a moment: "3:42 PM", or "3:42:07 PM" with seconds. */
export const officeTime = (at: Date, seconds = false) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        ...(seconds ? { second: '2-digit' } : {}),
    }).format(at);

/** The office time as "15:42": 24 hours, the value a time input takes. */
export const officeHm = (at: Date) =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(at);

/**
 * The office clock, ticking: each 15 s to the minute, or each second with seconds. Stamps and entries use
 * the server's time; this is a guide.
 */
export function useOfficeClock(seconds = false) {
    const [now, setNow] = useState(() => officeTime(new Date(), seconds));

    useEffect(() => {
        const t = window.setInterval(
            () => setNow(officeTime(new Date(), seconds)),
            seconds ? 1000 : 15000,
        );

        return () => window.clearInterval(t);
    }, [seconds]);

    return now;
}
