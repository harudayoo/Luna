import { usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import type { PetQuest } from '@/lib/pet';
import { DYE_NAMES, dyeColor } from '@/lib/pet';

/**
 * The panel's Quests tab (spec 2026-11-26-luna-moonling-style, slice 12): one-time goals, each paying a dye for the
 * moonling's items. Done ones say so; seasonal ones say when they can be done. Phone first: one row per quest, the
 * goal and a progress bar under its title, its dye on the right.
 */
export function PetQuests() {
    const { pet_quests: quests } = usePage<{ pet_quests?: PetQuest[] }>().props;

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
            <p className="text-sm text-muted">
                Finish a quest to earn a dye for your moonling’s items.{' '}
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
                        <span className="grid shrink-0 justify-items-center gap-1">
                            <span
                                aria-hidden
                                className={`size-8 ${q.done ? '' : 'opacity-70'}`}
                                style={
                                    {
                                        background: dyeColor(q.dye, 'balloon'),
                                        boxShadow:
                                            'inset 0 0 0 2px color-mix(in oklab, var(--ink) 25%, transparent)',
                                    } as CSSProperties
                                }
                            />
                            <span className="text-[11px] text-muted">
                                <span className="sr-only">Reward: </span>
                                {DYE_NAMES[q.dye]}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
