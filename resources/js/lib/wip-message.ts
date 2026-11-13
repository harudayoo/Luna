/*
 * The message Luna prepares for WIP's OCS Attendance channel after someone logs a late. Pure (no UI), so it's
 * unit-tested in tests/js/wip-message.test.ts.
 */

export type LateKind = 'late_in' | 'lunch' | 'early_out' | 'errand';

export type LateDetails = {
    kind: LateKind;
    date: string;
    start_time: string;
    end_time: string;
    note: string;
};

/** "09:47" -> "9:47 AM". */
export const clock = (t: string) => {
    const [h, m] = t.split(':').map(Number);

    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "2026-11-12" -> "Thu, Nov 12". */
export const longDay = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** The office hour now (Asia/Manila), for a good-morning or good-afternoon greeting. */
const officeHour = () =>
    Number(
        new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            hour: 'numeric',
            hourCycle: 'h23',
        }).format(new Date()),
    );

/**
 * Worded the way a person would write it, and different each time: a greeting, what happened (present
 * tense for today, past for an earlier day), the note as the reason, and a thanks. e.g.
 * "Hi Team! I'm running late today, in at 9:47 AM. Reason: Traffic. Thank you!"
 * People can still edit it before copying.
 */
export function wipMessage(late: LateDetails, today: string): string {
    const from = clock(late.start_time);
    const to = clock(late.end_time);
    const when = `on ${longDay(late.date)}`;

    const greeting = pick([
        'Hi Team!',
        'Hi team,',
        'Hello team!',
        'Hi everyone!',
        'Hello everyone,',
        officeHour() < 12 ? 'Good morning, team!' : 'Good afternoon, team!',
    ]);

    const body: Record<LateKind, string[]> =
        late.date === today
            ? {
                  late_in: [
                      `I'm running late today, in at ${to}.`,
                      `just a heads up, I'm in late today at ${to}.`,
                      `sorry, I'm late today. I'm in at ${to}.`,
                      `I came in a bit late today, at ${to}.`,
                  ],
                  lunch: [
                      `I'll be extending my lunch until ${to}.`,
                      `heads up, my lunch runs a bit long today. Back by ${to}.`,
                      `I'm taking a longer lunch today, back at ${to}.`,
                  ],
                  early_out: [
                      `I'll be logging off early today at ${from}.`,
                      `heads up, I need to leave early today at ${from}.`,
                      `I'll be out early today, leaving at ${from}.`,
                  ],
                  errand: [
                      `I'll be stepping out from ${from} to ${to}.`,
                      `heads up, I'll be away from ${from} to ${to} today.`,
                      `I need to step out for a bit, ${from} to ${to}.`,
                  ],
              }
            : {
                  late_in: [
                      `I came in late ${when}, at ${to}.`,
                      `logging my late ${when}: I came in at ${to}.`,
                  ],
                  lunch: [
                      `my lunch ${when} ran until ${to}.`,
                      `logging an extended lunch ${when}, back at ${to}.`,
                  ],
                  early_out: [
                      `I left early ${when}, at ${from}.`,
                      `logging my early out ${when}: I left at ${from}.`,
                  ],
                  errand: [
                      `I stepped out ${when} from ${from} to ${to}.`,
                      `logging that I was away ${when}, ${from} to ${to}.`,
                  ],
              };

    // A comma greeting runs on in lower case ("Hi team, heads up..."); after "!" a new sentence starts.
    const said = pick(body[late.kind]);
    const line = greeting.endsWith(',')
        ? said
        : said.charAt(0).toUpperCase() + said.slice(1);
    const note = late.note.trim().replace(/[.!]+$/, '');
    const reason = note
        ? ` ${pick([`Reason: ${note}.`, `(${note})`, `It's for: ${note}.`])}`
        : '';
    const thanks = pick([
        'Thank you!',
        'Thanks!',
        'Thanks, team!',
        'Thank you, everyone!',
    ]);

    return `${greeting} ${line}${reason} ${thanks}`;
}
