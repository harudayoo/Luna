/*
 * What the moonling says (spec 2026-11-25-luna-moonling-life, slice 5): a fixed table of short lines, one
 * picked at random. Taps answer by mood; Home events get their own lines. Never a word about lates, and
 * never guilt: time away gets a warm welcome back.
 */
import type { MoodLevel, Pet, PetMoment } from '@/lib/pet';

export const MOODS: { level: MoodLevel; label: string; hint: string }[] = [
    {
        level: 'glowing',
        label: 'Glowing',
        hint: 'Couldn’t be happier. Keep dropping by on office days.',
    },
    {
        level: 'happy',
        label: 'Happy',
        hint: 'Doing well. A daily pat makes it glow.',
    },
    {
        level: 'okay',
        label: 'Okay',
        hint: 'A visit each office day and a pat will cheer it up.',
    },
    {
        level: 'droopy',
        label: 'Droopy',
        hint: 'It misses you a little. Visit and give it a pat.',
    },
    {
        level: 'gloomy',
        label: 'Gloomy',
        hint: 'A pat today and a few visits will bring the glow back.',
    },
];

export const TRIGGERS = [
    'tap',
    'fed',
    'grew',
    'time',
    'leave',
    'duel',
    'away',
] as const;

export type Trigger = (typeof TRIGGERS)[number];

export const VOICE: { tap: Record<MoodLevel, string[]> } & Record<
    Exclude<Trigger, 'tap'>,
    string[]
> = {
    tap: {
        glowing: ['Hehe, that tickles!', 'I’m glowing today!', 'Boop! Again!'],
        happy: ['Hi hi!', 'Hehe, that tickles!', 'That was nice.'],
        okay: ['Oh, hello.', 'Mm, that’s nice.', 'Hi there.'],
        droopy: ['…just five more minutes.', 'Mm? Oh, hi.', 'A pat helps.'],
        gloomy: [
            '*small yawn* Hi.',
            'Glad you’re here.',
            'Thanks for the pat.',
        ],
    },
    fed: [
        'Thanks for stopping by!',
        'Good to see you today.',
        'Mmm, moonbeams. Thank you!',
    ],
    grew: [
        'Whoa, I grew!',
        'Look how big I’m getting!',
        'A new stage! Thank you!',
    ],
    time: [
        'Nice work on that item!',
        'Time logged. Yum!',
        'You’re on a roll today.',
    ],
    leave: [
        'Leave filed! Rest well when it comes.',
        'Ooh, a break is coming up.',
        'I’ll keep the moon warm while you’re off.',
    ],
    duel: [
        'Someone challenged us to a moon duel!',
        'A moon duel is waiting for you!',
        'Ready for a moon duel?',
    ],
    away: [
        'You’re back! I kept your seat warm.',
        'Welcome back! I saved you a moonbeam.',
        'Hey, you’re here! I missed you a little.',
    ],
};

/** A line for the trigger (taps by mood), picked with `rnd` (0 ≤ rnd < 1). */
export function voiceLine(
    trigger: Trigger,
    level: MoodLevel,
    rnd: () => number = Math.random,
): string {
    const lines = trigger === 'tap' ? VOICE.tap[level] : VOICE[trigger];

    return lines[Math.min(lines.length - 1, Math.floor(rnd() * lines.length))];
}

/**
 * What to say when Home loads, if anything: growing first, then coming back after 2+ office days away,
 * then today's news (a duel to answer, leave filed, time logged), then being fed by today's visit.
 */
export function homeCue(
    pet: Pick<Pet, 'days_away' | 'today'>,
    moment: PetMoment,
): Trigger | null {
    if (moment === 'grew') {
        return 'grew';
    }
    if (pet.days_away >= 2) {
        return 'away';
    }
    if (pet.today.duel_waiting) {
        return 'duel';
    }
    if (pet.today.leave_filed) {
        return 'leave';
    }
    if (pet.today.time_logged) {
        return 'time';
    }

    return moment === 'fed' ? 'fed' : null;
}
