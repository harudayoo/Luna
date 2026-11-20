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

export type LeavePart = 'full' | 'am' | 'pm' | 'hours';

export type LeaveDetails = {
    from: string;
    /** Empty for a single day. */
    to: string;
    part: LeavePart;
    /** Only read for part "hours". */
    start_time: string;
    end_time: string;
    note: string;
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const monthDay = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const fullDay = (iso: string) =>
    fmt(iso, { weekday: 'long', month: 'short', day: 'numeric' });
const addDays = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);

    return d.toISOString().slice(0, 10);
};
/** The first weekday after a date (holidays aren't known here; the text stays editable). */
const nextWeekday = (iso: string) => {
    let d = addDays(iso, 1);
    while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) {
        d = addDays(d, 1);
    }

    return d;
};

/**
 * The message for WIP's Attendance channel after you log your own leave. Built from parts, each with
 * several wordings, so no two read alike: a greeting, an optional lead-in, what and when (today, tomorrow,
 * a day or a range, in the right tense), the part of the day or the hours, the note as the reason, when
 * you're back, and a thanks. `avoid` is a text never to return (the one on screen, for Reword).
 */
export function wipLeaveMessage(
    leave: LeaveDetails,
    today: string,
    avoid?: string,
): string {
    let message = composeLeave(leave, today);
    for (let i = 0; i < 25 && message === avoid; i++) {
        message = composeLeave(leave, today);
    }

    return message;
}

function composeLeave(leave: LeaveDetails, today: string): string {
    const { from, part } = leave;
    const end = leave.to && leave.to > from ? leave.to : from;
    const range = end !== from;
    const tense = end < today ? 'past' : from <= today ? 'now' : 'future';
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);
    const s = clock(leave.start_time);
    const e = clock(leave.end_time);

    // A day on its own: "tomorrow", "Mon, Nov 23" or "Monday, Nov 23".
    const near = (iso: string) =>
        iso === today
            ? 'today'
            : iso === tomorrow
              ? 'tomorrow'
              : iso === yesterday
                ? 'yesterday'
                : null;
    // One day style per message, so a range never mixes "Monday" with "Fri".
    const dayStyle = pick([longDay, fullDay]);
    const bare = (iso: string) => near(iso) ?? dayStyle(iso);
    const nearWord = near(from);
    // "today, Fri, Nov 20" only for a whole day: before ", morning only" the commas pile up.
    const dated = (word: string) =>
        part === 'full' ? [`${word}, ${longDay(from)}`] : [];

    const when = range
        ? pick([
              `from ${bare(from)} to ${bare(end)}`,
              `from ${bare(from)} until ${bare(end)}`,
              `from ${bare(from)} through ${bare(end)}`,
              ...(from > tomorrow
                  ? [
                        `from ${fmt(from, { weekday: 'long' })} to ${fmt(end, { weekday: 'long' })} (${monthDay(from)} to ${monthDay(end)})`,
                    ]
                  : []),
          ])
        : {
              today: ['today', 'for today', ...dated('today')],
              tomorrow: [
                  'tomorrow',
                  `tomorrow (${monthDay(from)})`,
                  ...dated('tomorrow'),
              ],
              yesterday: ['yesterday', ...dated('yesterday')],
              day: [
                  `on ${longDay(from)}`,
                  `on ${fullDay(from)}`,
                  `on ${monthDay(from)} (${fmt(from, { weekday: 'short' })})`,
              ],
          }[nearWord ?? 'day'];
    const whenText = typeof when === 'string' ? when : pick(when);

    // "This morning", "tomorrow afternoon": the natural form when there is one.
    const merged =
        !range &&
        nearWord &&
        (part === 'am' || part === 'pm') &&
        Math.random() < 0.5
            ? `${nearWord === 'today' ? 'this' : nearWord} ${part === 'am' ? 'morning' : 'afternoon'}`
            : null;
    const sameHalf = s.slice(-2) === e.slice(-2);
    const ofTheDay = merged
        ? ''
        : {
              full: '',
              am: pick(
                  range
                      ? [
                            ', mornings only',
                            ' in the mornings',
                            ' (AM half days)',
                        ]
                      : [
                            ', morning only',
                            ' for the morning',
                            ', just the morning half',
                            ' (AM half day)',
                            ' for half a day, in the morning',
                        ],
              ),
              pm: pick(
                  range
                      ? [
                            ', afternoons only',
                            ' in the afternoons',
                            ' (PM half days)',
                        ]
                      : [
                            ', afternoon only',
                            ' for the afternoon',
                            ', just the afternoon half',
                            ' (PM half day)',
                            ' for half a day, in the afternoon',
                        ],
              ),
              hours: pick(
                  range
                      ? [` from ${s} to ${e} each day`, `, ${s} to ${e} daily`]
                      : [
                            ` from ${s} to ${e}`,
                            ` between ${s} and ${e}`,
                            `, ${s} to ${e}`,
                            ...(sameHalf
                                ? [` from ${s.slice(0, -3)} to ${e}`]
                                : []),
                        ],
              ),
          }[part];
    const span = `${merged ?? whenText}${ofTheDay}`;

    // A whole day "off" reads with the bare day: "I'm taking tomorrow off".
    const days = range ? `${bare(from)} to ${bare(end)}` : bare(from);
    const off = part === 'full';
    const said = pick(
        {
            future: [
                `I'll be on leave ${span}`,
                `I'll be on PTO ${span}`,
                `I'll be out ${span}`,
                `I'll be off ${span}`,
                `I'll be away ${span}`,
                `I'm taking leave ${span}`,
                `I'm taking PTO ${span}`,
                `I'll be taking a leave ${span}`,
                `I won't be in ${span}`,
                `I'll be out of office ${span}`,
                ...(off
                    ? [
                          `I'm taking ${days} off`,
                          `I filed a leave for ${days}`,
                          `I'll be taking ${days} off`,
                      ]
                    : []),
            ],
            now: [
                `I'm on leave ${span}`,
                `I'm on PTO ${span}`,
                `I'm out ${span}`,
                `I'm off ${span}`,
                `I'm away ${span}`,
                `I'm taking leave ${span}`,
                `I won't be in ${span}`,
                `I'm out of office ${span}`,
                ...(off
                    ? [`I'm taking ${days} off`, `I filed a leave for ${days}`]
                    : []),
            ],
            past: [
                `I was on leave ${span}`,
                `I was on PTO ${span}`,
                `I was out ${span}`,
                `I was off ${span}`,
                `I was away ${span}`,
                `I took leave ${span}`,
                `I wasn't in ${span}`,
                `I was out of office ${span}`,
                ...(off ? [`I took ${days} off`] : []),
            ],
        }[tense],
    );

    const lead = pick(
        tense === 'past'
            ? [
                  'for the record,',
                  'sorry for the late post,',
                  'belated post:',
                  'updating the channel:',
                  'just logging this:',
                  'late update:',
                  '',
                  '',
              ]
            : [
                  'just a heads up,',
                  'quick heads up,',
                  'FYI,',
                  'just letting you know',
                  'just so everyone knows,',
                  'please be informed that',
                  'a quick note:',
                  'for your info,',
                  '',
                  '',
                  '',
              ],
    );

    const greeting = pick([
        'Hi Team!',
        'Hi team,',
        'Hello team!',
        'Hi everyone!',
        'Hello everyone,',
        'Hi all,',
        'Hey team!',
        'Good day, team!',
        officeHour() < 12 ? 'Good morning, team!' : 'Good afternoon, team!',
    ]);
    // As with lates: a comma greeting runs on in lower case; after "!" a new sentence starts.
    const body = `${[lead, said].filter(Boolean).join(' ')}.`;
    const line = greeting.endsWith(',')
        ? body
        : body.charAt(0).toUpperCase() + body.slice(1);

    const note = leave.note.trim().replace(/[.!]+$/, '');
    const reason = note
        ? pick([
              `Reason: ${note}.`,
              `(${note})`,
              `Reason being: ${note}.`,
              `Details: ${note}.`,
              `Note: ${note}.`,
              `Context: ${note}.`,
          ])
        : '';

    // When you're back: the next weekday after a day off; later the same day after a morning or some hours.
    const back = nextWeekday(end);
    const onBack = back === tomorrow ? 'tomorrow' : `on ${longDay(back)}`;
    const returns =
        tense === 'past'
            ? []
            : part === 'full' || part === 'pm'
              ? [
                    `Back ${onBack}.`,
                    `I'll be back ${onBack}.`,
                    `Back to work ${onBack}.`,
                    `See you all ${onBack}!`,
                ]
              : range
                ? []
                : part === 'am'
                  ? [
                        'Back by 1:00 PM.',
                        'Back after lunch.',
                        "I'll be online again by 1:00 PM.",
                    ]
                  : leave.end_time < '18:00'
                    ? [`Back by ${e}.`, `I'll be back online at ${e}.`]
                    : [];
    const comeback = returns.length ? pick([...returns, '', '']) : '';

    const thanks = pick([
        'Thank you!',
        'Thanks!',
        'Thanks, team!',
        'Thank you, everyone!',
        'Thanks for understanding!',
        'Thank you for understanding.',
        'Thanks, all!',
        'Much appreciated, thanks!',
        'Salamat!',
        'Thanks a lot!',
    ]);

    return [greeting, line, reason, comeback, thanks].filter(Boolean).join(' ');
}
