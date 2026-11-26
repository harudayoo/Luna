import { usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import type { PetQuest, PetWeekly } from '@/lib/pet';
import { DYE_NAMES, dyeColor, PALETTE_NAMES, paletteStyle } from '@/lib/pet';

/** "Monday, Nov 23" from a date. */
const day = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('en', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });

/** A quest's reward: a dye swatch, or a shade swatch drawn like the wardrobe's. */
function Reward({ quest }: { quest: PetQuest }) {
    const style: CSSProperties = quest.shade
        ? {
              ...(paletteStyle(quest.shade) as CSSProperties),
              background: 'var(--pet-body)',
              boxShadow: 'inset 0 0 0 2px var(--pet-line)',
          }
        : {
              background: quest.dye
                  ? dyeColor(quest.dye, 'balloon')
                  : undefined,
              boxShadow:
                  'inset 0 0 0 2px color-mix(in oklab, var(--ink) 25%, transparent)',
          };
    const name = quest.shade
        ? `${PALETTE_NAMES[quest.shade]} shade`
        : quest.dye
          ? DYE_NAMES[quest.dye]
          : '';

    return (
        <span className="grid shrink-0 justify-items-center gap-1">
            <span
                aria-hidden
                className={`size-8 ${quest.done ? '' : 'opacity-70'}`}
                style={style}
            />
            <span className="text-[11px] text-muted">
                <span className="sr-only">Reward: </span>
                {name}
            </span>
        </span>
    );
}

/** This week's quests (slice 18 of the collection spec): small, paying a little XP, new every Monday. */
function Weekly({ weekly }: { weekly: PetWeekly }) {
    return (
        <section aria-label="This week" className="grid gap-2 bg-bg p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="ocs-eyebrow mb-0">This week</p>
                <p className="text-xs text-muted">
                    New quests {day(weekly.resets)}
                </p>
            </div>
            <ul className="grid gap-2">
                {weekly.quests.map((q) => (
                    <li key={q.key} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-sm">
                            <span className="font-semibold">{q.title}</span>
                            <span className="mt-1 flex items-center gap-2">
                                <span
                                    role="progressbar"
                                    aria-label={`${q.title} progress`}
                                    aria-valuemin={0}
                                    aria-valuemax={q.target}
                                    aria-valuenow={q.progress}
                                    className="h-1.5 flex-1 bg-surface-hover"
                                >
                                    <span
                                        className="block h-full bg-primary"
                                        style={{
                                            width: `${(q.progress / Math.max(1, q.target)) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="font-mono text-[11px] text-muted">
                                    {q.progress}/{q.target}
                                </span>
                            </span>
                        </span>
                        <span
                            className={`shrink-0 text-xs font-semibold ${q.done ? 'text-success' : 'text-muted'}`}
                        >
                            {q.done ? '✓ ' : ''}+{q.xp} XP
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted">
                {weekly.streak > 0
                    ? `🏅 ${weekly.streak} ${weekly.streak === 1 ? 'week' : 'weeks'} in a row with every weekly quest done.`
                    : 'Finish all three in a week to start a quest streak.'}
            </p>
        </section>
    );
}

/**
 * The panel's Quests tab (spec 2026-11-26-luna-moonling-style, slice 12): one-time goals, each paying a dye for the
 * moonling's items. Done ones say so; seasonal ones say when they can be done. Phone first: one row per quest, the
 * goal and a progress bar under its title, its dye on the right.
 */
export function PetQuests() {
    const { pet_quests: quests, pet_weekly: weekly } = usePage<{
        pet_quests?: PetQuest[];
        pet_weekly?: PetWeekly;
    }>().props;

    if (!quests) {
        return (
            <p className="py-6 text-center text-sm text-muted">
                Loading quests…
            </p>
        );
    }

    const left = quests.filter((q) => !q.done).length;

    return (
        <section aria-label="Moon quests" className="grid gap-3">
            {weekly && <Weekly weekly={weekly} />}
            <p className="text-sm text-muted">
                Finish a quest to earn a colour for your moonling.{' '}
                {left === 0 ? 'You’ve done them all!' : `${left} still to do.`}
            </p>
            <ul className="grid gap-1">
                {quests.map((q) => (
                    <li
                        key={q.key}
                        className={`flex items-center gap-3 p-3 ${q.done ? 'bg-surface-hover' : 'bg-bg'}`}
                    >
                        <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                                {q.title}
                                {q.seasonal && (
                                    <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                                        Seasonal
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-muted">{q.goal}</p>
                            {q.done ? (
                                <p className="mt-1 text-xs font-semibold text-success">
                                    ✓ Done
                                </p>
                            ) : (
                                <div className="mt-2 flex items-center gap-2">
                                    <div
                                        role="progressbar"
                                        aria-label={`${q.title} progress`}
                                        aria-valuemin={0}
                                        aria-valuemax={q.target}
                                        aria-valuenow={q.progress}
                                        className="h-1.5 flex-1 bg-surface-hover"
                                    >
                                        <div
                                            className="h-full bg-primary"
                                            style={{
                                                width: `${(q.progress / Math.max(1, q.target)) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="font-mono text-[11px] text-muted">
                                        {q.progress}/{q.target}
                                    </span>
                                </div>
                            )}
                        </div>
                        <Reward quest={q} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
