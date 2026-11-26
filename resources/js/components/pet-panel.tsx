import { router, usePage } from '@inertiajs/react';
import { Check, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import InputError from '@/components/input-error';
import { PetBoard } from '@/components/pet-board';
import { PetBubble, useBubble } from '@/components/pet-bubble';
import { PetDuels } from '@/components/pet-duels';
import { PetNest } from '@/components/pet-nest';
import { PetSprite } from '@/components/pet-sprite';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { petIdle, petPoke } from '@/lib/ocs';
import type { Pet, PetDetail } from '@/lib/pet';
import { stagePath, stageProgress, streakLabel } from '@/lib/pet';
import { usePetPlay } from '@/lib/pet-play';
import { MOODS, voiceLine } from '@/lib/pet-voice';

/** One square per office day this week (pet_detail.week). */
const DAY_SHADE: Record<PetDetail['week'][number]['status'], string> = {
    visited: 'bg-primary',
    missed: 'bg-surface-hover',
    // Hatched: a weekend-like day off (holiday or own leave) that doesn't break the streak.
    skipped:
        'bg-[repeating-linear-gradient(45deg,var(--color-surface-hover)_0_4px,transparent_4px_8px)]',
    upcoming: 'bg-bg',
};

const DAY_WORD: Record<PetDetail['week'][number]['status'], string> = {
    visited: 'visited',
    missed: 'missed',
    skipped: 'day off',
    upcoming: 'to come',
};

/**
 * The pet up close (spec 2026-11-25-luna-pet-social, slice 1): tap it, name it, see the stages ahead, this week's
 * visits, what gives XP and what gave it lately. The extras (pet_detail) load when it opens; full screen on phones.
 * Tabs: the pet, the office board (slice 2), moon duels (slice 3). `startTab` opens on a tab (the bell's ?pet=duels).
 */
export type PetTab = 'pet' | 'board' | 'duels' | 'nest';

/** The optional props each tab needs (the board offers duels, so it loads those too). */
const TAB_PROPS: Record<PetTab, string[]> = {
    pet: ['pet_detail'],
    board: ['pet_board', 'pet_duels'],
    duels: ['pet_duels'],
    nest: ['pet_nest'],
};

export function PetPanel({
    pet,
    open,
    onOpenChange,
    startTab = 'pet',
}: {
    pet: Pet;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    startTab?: PetTab;
}) {
    const { pet_detail: detail, errors } = usePage<{
        pet_detail?: PetDetail;
        errors: Record<string, string>;
    }>().props;
    const progress = stageProgress(pet.xp);
    const sprite = useRef<HTMLSpanElement>(null);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(pet.name ?? '');
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<PetTab>('pet');
    const area = useRef<HTMLDivElement>(null);
    const pat = useRef<HTMLButtonElement>(null);
    const [line, say] = useBubble();
    const mood = MOODS.find((m) => m.level === pet.mood.level) ?? MOODS[0];

    // A tap or a tug: it wobbles, says something, and the first one each office day is its pat (no XP).
    const tap = useCallback(() => {
        if (sprite.current) {
            petPoke(sprite.current);
        }
        say(voiceLine('tap', pet.mood.level));
        if (!pet.mood.patted) {
            router.post(
                PetController.pat(),
                {},
                { preserveScroll: true, preserveState: true, only: ['pet'] },
            );
        }
    }, [pet.mood.level, pet.mood.patted, say]);

    usePetPlay(pat, {
        area,
        tug: true,
        onTap: tap,
        active: open && tab === 'pet',
    });

    // The panel alone loads what the open tab shows: one partial reload per opening or tab change, so two
    // reloads never race each other.
    useEffect(() => {
        if (open) {
            setTab(startTab);
            router.reload({ only: TAB_PROPS[startTab] });
        } else {
            setEditing(false);
            setTab('pet');
        }
    }, [open, startTab]);

    const showTab = (next: PetTab) => {
        setTab(next);
        router.reload({ only: TAB_PROPS[next] });
    };

    // The idle bob, once the dialog has put the sprite on the page.
    useEffect(() => {
        if (!open || tab !== 'pet') {
            return;
        }

        let stop = () => {};
        const frame = requestAnimationFrame(() => {
            if (sprite.current) {
                stop = petIdle(sprite.current);
            }
        });

        return () => {
            cancelAnimationFrame(frame);
            stop();
        };
        // The mood redraws the eyes, so the idle blink restarts on the new ones.
    }, [open, tab, pet.stage, pet.mood.level]);

    const save = () =>
        router.patch(
            PetController.update(),
            { name },
            {
                preserveScroll: true,
                only: ['pet', 'errors'],
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setEditing(false),
            },
        );

    const title = pet.name ?? 'Your moonling';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                ref={area}
                className="h-dvh max-h-dvh w-full max-w-none content-start overflow-y-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg"
            >
                <div>
                    <p className="ocs-eyebrow mb-0">Your moonling</p>
                    {editing ? (
                        <form
                            className="mt-1 flex items-center gap-2 pr-8"
                            onSubmit={(e) => {
                                e.preventDefault();
                                save();
                            }}
                        >
                            <DialogTitle className="sr-only">
                                Name your moonling
                            </DialogTitle>
                            <Input
                                autoFocus
                                maxLength={20}
                                aria-label="Pet name"
                                placeholder="Give it a name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        // Esc cancels the edit, not the whole panel.
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setName(pet.name ?? '');
                                        setEditing(false);
                                    }
                                }}
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={saving}
                                aria-label="Save name"
                            >
                                <Check />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Cancel"
                                onClick={() => {
                                    setName(pet.name ?? '');
                                    setEditing(false);
                                }}
                            >
                                <X />
                            </Button>
                        </form>
                    ) : (
                        <div className="mt-1 flex items-center gap-1 pr-8">
                            <DialogTitle className="text-2xl font-semibold">
                                {title}
                            </DialogTitle>
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label={
                                    pet.name
                                        ? 'Rename your pet'
                                        : 'Name your pet'
                                }
                                onClick={() => setEditing(true)}
                            >
                                <Pencil />
                            </Button>
                        </div>
                    )}
                    <InputError message={errors.name} />
                    <DialogDescription className="text-sm text-muted">
                        It grows as you use Luna. Tap it to say hi.
                    </DialogDescription>
                </div>

                <div
                    role="tablist"
                    aria-label="Pet views"
                    className="grid grid-cols-4 gap-1 bg-surface-hover p-1"
                >
                    {(
                        [
                            ['pet', 'Your pet'],
                            ['board', 'Board'],
                            ['duels', 'Duels'],
                            ['nest', 'Nest'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => showTab(key)}
                            className="min-h-10 px-3 text-sm font-semibold text-muted aria-selected:bg-primary aria-selected:text-on-primary focus-visible:shadow-lift focus-visible:outline-none"
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'board' ? (
                    <PetBoard pet={pet} />
                ) : tab === 'duels' ? (
                    <PetDuels pet={pet} revealLatest={startTab === 'duels'} />
                ) : tab === 'nest' ? (
                    <PetNest />
                ) : (
                    <>
                        {/* The pet, large. Tap or tug it (no XP; the first each day is its pat); arrows make it look. */}
                        <div className="relative mx-auto w-fit">
                            <button
                                ref={pat}
                                type="button"
                                aria-label={`Pat ${title}`}
                                aria-describedby="pet-play-hint"
                                onClick={(e) => {
                                    // Pointer taps come through the tug on release; this is Enter or Space.
                                    if (e.detail === 0) {
                                        tap();
                                    }
                                }}
                                className="block cursor-grab touch-none p-2 select-none focus-visible:bg-surface-hover focus-visible:outline-none active:cursor-grabbing"
                            >
                                <span ref={sprite} className="inline-block">
                                    <PetSprite
                                        stage={progress.stage}
                                        kind={pet.kind}
                                        title={`${title}: ${progress.name}, ${mood.label.toLowerCase()}`}
                                        crown={pet.crown}
                                        mood={pet.mood.level}
                                        className="size-50 min-[390px]:size-60"
                                    />
                                </span>
                            </button>
                            <PetBubble text={line} place="top" />
                            <span id="pet-play-hint" className="sr-only">
                                Arrow keys make it look around.
                            </span>
                        </div>
                        {pet.crown && (
                            <p className="-mt-2 text-center text-sm font-semibold">
                                👑 Last week&rsquo;s Moon Cup champion
                            </p>
                        )}

                        <section aria-label="Progress">
                            <p className="text-lg leading-6 font-semibold">
                                {progress.name}
                            </p>
                            <div
                                role="progressbar"
                                aria-label="Growth to the next stage"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(
                                    progress.fraction * 100,
                                )}
                                className="mt-2 h-2 bg-surface-hover"
                            >
                                <div
                                    className="h-full bg-primary"
                                    style={{
                                        width: `${progress.fraction * 100}%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1 flex justify-between gap-2 text-xs text-muted">
                                <span className="font-mono">
                                    {progress.label}
                                </span>
                                <span>{streakLabel(pet.streak)}</span>
                            </p>
                        </section>

                        <section
                            aria-label="Mood"
                            className="bg-bg px-3 py-2 text-sm"
                        >
                            <span className="font-semibold">{mood.label}</span>
                            <span className="text-muted">
                                {' '}
                                &middot; {mood.hint}
                            </span>
                        </section>

                        <section aria-label="Growth path">
                            <p className="ocs-eyebrow">Growth path</p>
                            <ol className="grid grid-cols-5 gap-1">
                                {stagePath(progress.stage).map((s) => (
                                    <li
                                        key={s.stage}
                                        aria-current={
                                            s.state === 'current'
                                                ? 'step'
                                                : undefined
                                        }
                                        className={`flex flex-col items-center gap-1 py-2 ${s.state === 'current' ? 'bg-surface-hover' : ''}`}
                                    >
                                        <PetSprite
                                            stage={s.stage}
                                            kind={pet.kind}
                                            title={
                                                s.state === 'locked'
                                                    ? `${s.name}, still to come`
                                                    : s.name
                                            }
                                            locked={s.state === 'locked'}
                                            className="size-12"
                                        />
                                        <span
                                            className={`text-center text-[11px] leading-tight ${s.state === 'locked' ? 'text-muted' : 'font-semibold'}`}
                                        >
                                            {s.name}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section aria-label="This week">
                            <p className="ocs-eyebrow">This week</p>
                            {detail ? (
                                <ol className="grid grid-cols-5 gap-1">
                                    {detail.week.map((d) => (
                                        <li
                                            key={d.date}
                                            className="flex flex-col items-center gap-1"
                                        >
                                            <span
                                                aria-hidden
                                                className={`h-8 w-full ${DAY_SHADE[d.status]}`}
                                            />
                                            <span className="text-xs text-muted">
                                                {d.day}
                                                <span className="sr-only">
                                                    : {DAY_WORD[d.status]}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div aria-hidden className="h-13 bg-bg" />
                            )}
                            <p className="mt-2 text-xs text-muted">
                                Filled: visited. Shaded: missed. Striped:
                                holiday or your leave (it doesn&rsquo;t break
                                your streak).
                            </p>
                        </section>

                        <section aria-label="How it grows">
                            <p className="ocs-eyebrow">How it grows</p>
                            {detail && (
                                <ul className="grid gap-1 text-sm">
                                    <Source
                                        what="Open Luna on an office day"
                                        xp={`${detail.xp.visit} XP + 1 a streak day (up to +${detail.streak_bonus_max})`}
                                    />
                                    <Source
                                        what="Log time on an item"
                                        xp={`${detail.xp.item_time} XP, once per item a day`}
                                    />
                                    <Source
                                        what="File leave"
                                        xp={`${detail.xp.leave} XP`}
                                    />
                                    <Source
                                        what="Open your released payslip"
                                        xp={`${detail.xp.payslip} XP, once each`}
                                    />
                                    <Source
                                        what="Finish a moon duel"
                                        xp={`${detail.duel_xp.win} XP a win, ${detail.duel_xp.loss} otherwise, first a day`}
                                    />
                                </ul>
                            )}
                        </section>

                        <section aria-label="Recent XP">
                            <p className="ocs-eyebrow">Recent XP</p>
                            {!detail ? (
                                <p className="text-sm text-muted">
                                    Loading&hellip;
                                </p>
                            ) : detail.recent.length === 0 ? (
                                <p className="text-sm text-muted">
                                    Nothing yet.
                                </p>
                            ) : (
                                <ul className="grid gap-1">
                                    {detail.recent.map((r, i) => (
                                        <li
                                            key={`${r.at}-${i}`}
                                            className="flex items-baseline gap-3 bg-bg px-3 py-2 text-sm"
                                        >
                                            <span className="w-9 shrink-0 font-mono font-semibold text-primary">
                                                +{r.xp}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                {r.label}
                                            </span>
                                            <span className="shrink-0 text-xs text-muted">
                                                {short(r.at)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Source({ what, xp }: { what: string; xp: string }) {
    return (
        <li className="flex flex-wrap justify-between gap-x-3 bg-bg px-3 py-2">
            <span>{what}</span>
            <span className="font-mono text-xs text-muted">{xp}</span>
        </li>
    );
}

const short = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));
