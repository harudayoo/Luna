/*
 * What the moonling says (spec 2026-11-25-luna-moonling-life, slice 5): a fixed table of short lines, one
 * picked at random. Taps answer by mood; Home events get their own lines. Never a word about lates, and
 * never guilt: time away gets a warm welcome back.
 */
import type {
    MoodLevel,
    MoonlingKind,
    Pet,
    PetMoment,
    WearItem,
} from '@/lib/pet';

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
    // Slice 8: the part of the office day, Monday and Friday, payday, the eve of a day off, the crown week, quick
    // taps in a row, and putting something on.
    'morning',
    'afternoon',
    'evening',
    'monday',
    'friday',
    'payday',
    'eve',
    'crown',
    'combo',
    'outfit',
] as const;

export type Trigger = (typeof TRIGGERS)[number];

/** Every line in one table (slice 8: 8+ per moment and per tap mood). Never about lates, never guilt. */
export const VOICE: { tap: Record<MoodLevel, string[]> } & Record<
    Exclude<Trigger, 'tap'>,
    string[]
> = {
    tap: {
        glowing: [
            'Hehe, that tickles!',
            'I’m glowing today!',
            'Boop! Again!',
            'Best. Day. Ever.',
            'I could float right off the screen!',
            'You make me sparkle.',
            'Wheee!',
            'Happy happy happy!',
            'Look at me shine!',
        ],
        happy: [
            'Hi hi!',
            'Hehe, that tickles!',
            'That was nice.',
            'Hello, friend!',
            'Another pat? Yes please.',
            'I like it here.',
            'You’re my favourite.',
            'Boop right back at you!',
        ],
        okay: [
            'Oh, hello.',
            'Mm, that’s nice.',
            'Hi there.',
            'A pat! Thank you.',
            'Just floating along.',
            'Hello again.',
            'That helps.',
            'Nice to see you.',
        ],
        droopy: [
            '…just five more minutes.',
            'Mm? Oh, hi.',
            'A pat helps.',
            '*sleepy blink*',
            'Oh! You’re here.',
            'That’s cosy.',
            'I’m waking up, slowly.',
            'One more pat?',
        ],
        gloomy: [
            '*small yawn* Hi.',
            'Glad you’re here.',
            'Thanks for the pat.',
            'That feels better already.',
            'Stay a moment?',
            'A little brighter now.',
            'Hi. I’m happy you came.',
            'You cheer me up.',
        ],
    },
    fed: [
        'Thanks for stopping by!',
        'Good to see you today.',
        'Mmm, moonbeams. Thank you!',
        'You came! Yay!',
        'My favourite part of the day.',
        'Breakfast of moonlings: you.',
        'Another day together!',
        'Hello hello hello!',
    ],
    grew: [
        'Whoa, I grew!',
        'Look how big I’m getting!',
        'A new stage! Thank you!',
        'I feel taller!',
        'Did you see that? I grew!',
        'New me, who dis?',
        'Growing up so fast!',
        'Thank you for raising me!',
    ],
    time: [
        'Nice work on that item!',
        'Time logged. Yum!',
        'You’re on a roll today.',
        'Busy bee! Busy moon!',
        'Look at you go.',
        'Every item gets me bigger!',
        'Great progress today.',
        'Work time is grow time.',
    ],
    leave: [
        'Leave filed! Rest well when it comes.',
        'Ooh, a break is coming up.',
        'I’ll keep the moon warm while you’re off.',
        'Rest is good for moonlings and people.',
        'A day off! Do something fun.',
        'I’ll be right here when you’re back.',
        'Recharge time!',
        'Holiday plans? Tell me everything.',
    ],
    duel: [
        'Someone challenged us to a moon duel!',
        'A moon duel is waiting for you!',
        'Ready for a moon duel?',
        'A challenger appears!',
        'Moon, star or comet? Your call.',
        'Let’s show them our moves!',
        'A duel! My favourite!',
        'Someone wants to play!',
    ],
    away: [
        'You’re back! I kept your seat warm.',
        'Welcome back! I saved you a moonbeam.',
        'Hey, you’re here! I missed you a little.',
        'There you are! Hello!',
        'Welcome back, friend.',
        'I counted the stars while you were out.',
        'Yay, you’re home!',
        'Good to have you back.',
    ],
    morning: [
        'Good morning!',
        'Morning! Ready for today?',
        'Rise and shine!',
        'Coffee for you, moonbeams for me.',
        'A fresh day!',
        'Morning, sunshine. Er, moonshine.',
        'Let’s make today a good one.',
        'Hello, morning person!',
    ],
    afternoon: [
        'Hope lunch was tasty!',
        'Good afternoon!',
        'Halfway there!',
        'Afternoon stretch time.',
        'Back from lunch? Hi again!',
        'The afternoon’s all yours.',
        'Keep going, you’ve got this.',
        'Afternoon hello!',
    ],
    evening: [
        'Almost home time!',
        'What a day!',
        'Wrapping up? Nice work today.',
        'The moon’s coming out soon. That’s me!',
        'Good job today.',
        'Last stretch!',
        'Hello again before you go!',
        'Evening is my favourite time.',
    ],
    monday: [
        'Happy Monday!',
        'A brand new week!',
        'Monday, let’s do this.',
        'New week, new moonbeams.',
        'Hi! Did you have a nice weekend?',
        'Fresh start!',
        'Monday hugs!',
        'Ready for a good week?',
    ],
    friday: [
        'Happy Friday!',
        'Friday! The weekend is so close.',
        'You made it to Friday!',
        'Weekend plans?',
        'Friday feeling!',
        'Almost weekend!',
        'One more day of the week. Let’s go!',
        'Friday is my favourite day.',
    ],
    payday: [
        'Payday! Treat yourself.',
        'Your payslip is in!',
        'Payday dance!',
        'Cha-ching!',
        'Something nice for you today?',
        'Payday hugs!',
        'Hard work pays off!',
        'Your payslip is ready to see.',
    ],
    eve: [
        'Day off tomorrow! Rest well.',
        'Enjoy your break tomorrow!',
        'Tomorrow’s a rest day. Yay!',
        'Big plans for tomorrow?',
        'I’ll guard the moon tomorrow.',
        'Rest well, see you after!',
        'A day off! Sleep in a little.',
        'Have fun tomorrow!',
    ],
    crown: [
        'We’re the Moon Cup champions!',
        'Do you like my crown?',
        'Champion of the moon!',
        'Bow before the crown! Kidding.',
        'This crown suits me.',
        'Best duelist in the office!',
        'The Moon Cup is ours this week!',
        'Crowned and glowing!',
    ],
    combo: [
        'Whoa, dizzy!',
        'Hehehe, stop, stop!',
        'Tickle attack!',
        'So many pats!',
        'I’m spinning!',
        'Again! Again!',
        'Hahaha!',
        'Boop boop boop!',
    ],
    outfit: [
        'Ooh, new look!',
        'How do I look?',
        'Fancy!',
        'I love it!',
        'Very stylish.',
        'Mirror, please!',
        'This is so me.',
        'Thank you! I feel fabulous.',
    ],
};

/** A few lines of each kind's own, mixed into taps. */
export const KIND_LINES: Record<MoonlingKind, string[]> = {
    moon: ['Full of moonlight!', 'I’m a moon. A small one.', 'Crescent smile!'],
    star: ['Twinkle!', 'Make a wish!', 'Shine on!'],
    comet: ['Zoom zoom!', 'Fastest moonling around!', 'Catch my tail!'],
    eclipse: [
        'Shh, I’m being mysterious.',
        'Light and shadow!',
        'Ooh, spooky. Kidding!',
    ],
    aurora: ['Ripple ripple!', 'All the colours!', 'I dance in the sky.'],
    nova: [
        'Kaboom! Sparkles!',
        'Burst of joy!',
        'Bright, brighter, brightest!',
    ],
};

/**
 * A line for the trigger (taps by mood, with the kind's own lines mixed in), picked with `rnd` (0 ≤ rnd < 1),
 * never the same as `last`.
 */
export function voiceLine(
    trigger: Trigger,
    level: MoodLevel,
    rnd: () => number = Math.random,
    last?: string,
    kind?: MoonlingKind,
): string {
    const all =
        trigger === 'tap'
            ? [...VOICE.tap[level], ...(kind ? KIND_LINES[kind] : [])]
            : VOICE[trigger];
    const lines = all.filter((l) => l !== last);

    return lines[Math.min(lines.length - 1, Math.floor(rnd() * lines.length))];
}

/**
 * What to say when Home loads: growing first, then coming back after 2+ office days away, then today's news (a duel
 * to answer, payday, a day off tomorrow, leave filed, time logged), then the crown week, Monday or Friday, being fed
 * by today's visit, and else the part of the day.
 */
export function homeCue(
    pet: Pick<Pet, 'days_away' | 'today'> & Partial<Pick<Pet, 'crown'>>,
    moment: PetMoment,
): Trigger | null {
    const t = pet.today;
    if (moment === 'grew') {
        return 'grew';
    }
    if (pet.days_away >= 2) {
        return 'away';
    }
    if (t.duel_waiting) {
        return 'duel';
    }
    if (t.payday) {
        return 'payday';
    }
    if (t.day_off_tomorrow) {
        return 'eve';
    }
    if (t.leave_filed) {
        return 'leave';
    }
    if (t.time_logged) {
        return 'time';
    }
    if (pet.crown) {
        return 'crown';
    }
    if (t.weekday === 1) {
        return 'monday';
    }
    if (t.weekday === 5) {
        return 'friday';
    }
    if (moment === 'fed') {
        return 'fed';
    }

    return t.part ?? null;
}

/**
 * "Now and then" (the user, slice 8): Home speaks once in each part of the office day (`key` is "date:part"; `said`
 * is the last key it spoke in), but growing a stage always speaks.
 */
export function shouldSpeak(
    cue: Trigger | null,
    key: string,
    said: string | null,
): boolean {
    if (!cue) {
        return false;
    }

    return cue === 'grew' || said !== key;
}

/**
 * What it says when you tap one of its items in the panel (spec 2026-11-26-luna-moonling-style, slice 10). Same
 * rules as the rest: kind, short, never about lates.
 */
export const ITEM_LINES: Record<WearItem, string[]> = {
    star_clip: ['Twinkle twinkle!', 'My lucky star.'],
    comet_trail: ['Whoosh!', 'A comet, just for me.'],
    halo: ['Behaving today. Mostly.', 'Shiny ring!'],
    scarf: ['So cosy.', 'Warm and snug.'],
    bow: ['Do I look cute?', 'Tied it myself!'],
    propeller: ['Wheee, liftoff!', 'Spin, spin, spin!'],
    glasses: ['I can see everything now.', 'Very scholarly.'],
    wings: ['Flap flap!', 'Almost flying!'],
    cape: ['To the rescue!', 'Swoosh!'],
    balloon: ['Don’t let go!', 'Up, up, up!'],
    wand: ['Abracadabra!', 'Sparkle magic!'],
    lantern: ['Lighting the way.', 'A little glow for you.'],
};

/** A line for a tapped item, never the same as `last` twice in a row. */
export function itemLine(item: WearItem, last?: string): string {
    const lines = ITEM_LINES[item].filter((l) => l !== last);

    return lines[Math.floor(Math.random() * lines.length)];
}
