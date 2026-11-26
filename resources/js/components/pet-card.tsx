import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { PetBubble, useBubble } from '@/components/pet-bubble';
import type { PetTab } from '@/components/pet-panel';
import { PetPanel } from '@/components/pet-panel';
import { PetSprite } from '@/components/pet-sprite';
import { ocsRef, petFed, petGrow, petIdle } from '@/lib/ocs';
import type { Pet, PetMoment } from '@/lib/pet';
import { petTitle, stageProgress, streakLabel } from '@/lib/pet';
import { usePetPlay } from '@/lib/pet-play';
import { homeCue, shouldSpeak, voiceLine } from '@/lib/pet-voice';

/** Where Home remembers the last part of the day the moonling spoke in ("date:part"). */
const SAID_KEY = 'luna-pet-said';

/**
 * The person's pet on Home (spec 2026-11-24-luna-pet): it grows from visits, item time, leave and
 * payslips. It hops when today's visit feeds it and pops when it grows a stage; opening it shows the
 * pet up close (PetPanel, spec 2026-11-25-luna-pet-social).
 */
export function PetCard({ pet, moment }: { pet: Pet; moment: PetMoment }) {
    const sprite = useRef<HTMLSpanElement>(null);
    const progress = stageProgress(pet.xp);
    const [open, setOpen] = useState(false);
    const [startTab, setStartTab] = useState<PetTab>('pet');
    const tilt = useRef(ocsRef(['tilt'])).current;
    const card = useRef<HTMLDivElement>(null);
    const [line, say] = useBubble();
    const { pet_open: openTab } = usePage<{ pet_open?: PetTab | null }>().props;

    // A duel notice in the bell links to /dashboard?pet=duels; the server turns that into the plain address and a
    // one-time `pet_open: 'duels'` prop, which opens the panel on that tab when Home mounts.
    useEffect(() => {
        if (openTab) {
            setStartTab(openTab);
            setOpen(true);
        }
        // Only on mount: partial reloads keep the old prop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const el = sprite.current;

        if (!el) {
            return;
        }

        if (moment === 'grew') {
            petGrow(el);
        } else if (moment === 'fed') {
            petFed(el);
        }

        return petIdle(el);
        // The mood redraws the eyes, so the idle blink restarts on the new ones.
    }, [moment, pet.stage, pet.mood.level]);

    // Its eyes follow a mouse over the card (slice 5); the card itself opens the panel, so no tug here.
    usePetPlay(sprite, { area: card });

    // Something to say about this visit, once Home has settled: "now and then" (slice 8), once in each part of the
    // office day, remembered in this browser; growing a stage always speaks.
    useEffect(() => {
        const cue = homeCue(pet, moment);
        const key = `${new Date().toDateString()}:${pet.today.part}`;
        let said: string | null = null;
        try {
            said = window.localStorage.getItem(SAID_KEY);
        } catch {
            // Storage blocked: speak as before, once per load.
        }
        if (!cue || !shouldSpeak(cue, key, said)) {
            return;
        }
        const t = window.setTimeout(() => {
            say(voiceLine(cue, pet.mood.level));
            try {
                window.localStorage.setItem(SAID_KEY, key);
            } catch {
                // Nothing to remember it in.
            }
        }, 900);

        return () => window.clearTimeout(t);
        // Only on mount: at most one line per Home load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <div
                ref={(el) => {
                    card.current = el;
                    tilt(el);
                }}
                role="button"
                tabIndex={0}
                data-ocs="tilt"
                aria-label={`Open ${pet.name ?? 'your moonling'}`}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
                className="ocs-card flex cursor-pointer items-center gap-4 p-4! sm:p-5! lg:gap-3 lg:p-4!"
            >
                {/* Beside the text everywhere; smaller in the desktop rail so the whole rail fits on screen and stays put. */}
                <span className="relative inline-block">
                    <span ref={sprite} className="inline-block">
                        <PetSprite
                            stage={progress.stage}
                            kind={pet.kind}
                            palette={pet.palette}
                            wear={pet.wear}
                            dyes={pet.dyes}
                            title={`Your moonling: ${progress.name}${pet.crown ? ', Moon Cup champion' : ''}`}
                            crown={pet.crown}
                            mood={pet.mood.level}
                        />
                    </span>
                    <PetBubble text={line} place="card" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="ocs-eyebrow mb-0">Your moonling</p>
                    <p className="mt-1 text-lg leading-6 font-semibold">
                        {petTitle(pet.name, progress.name)}
                    </p>
                    <div
                        role="progressbar"
                        aria-label="Growth to the next stage"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress.fraction * 100)}
                        className="mt-2 h-2 bg-surface-hover"
                    >
                        <div
                            className="h-full bg-primary"
                            style={{ width: `${progress.fraction * 100}%` }}
                        />
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted">
                        {progress.label}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                        {streakLabel(pet.streak)}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                        Tap to see it up close.
                    </p>
                </div>
            </div>
            <PetPanel
                pet={pet}
                open={open}
                startTab={startTab}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) {
                        setStartTab('pet');
                    }
                }}
            />
        </>
    );
}
