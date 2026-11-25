import { useEffect, useRef } from 'react';
import { PetSprite } from '@/components/pet-sprite';
import { petFed, petGrow, petIdle } from '@/lib/ocs';
import type { Pet, PetMoment } from '@/lib/pet';
import { stageProgress, streakLabel } from '@/lib/pet';

/**
 * The person's pet on Home (spec 2026-11-24-luna-pet): it grows from visits, item time, leave and
 * payslips. Nothing to tap; it hops when today's visit feeds it and pops when it grows a stage.
 */
export function PetCard({ pet, moment }: { pet: Pet; moment: PetMoment }) {
    const sprite = useRef<HTMLSpanElement>(null);
    const progress = stageProgress(pet.xp);

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
    }, [moment, pet.stage]);

    return (
        <section
            aria-label="Your moonling"
            className="ocs-card flex items-center gap-4 p-4! sm:p-5! lg:flex-col lg:items-stretch"
        >
            {/* Beside the text on phones and tablets; above it in the narrow desktop rail. */}
            <span ref={sprite} className="inline-block self-center">
                <PetSprite
                    stage={progress.stage}
                    title={`Your moonling: ${progress.name}`}
                />
            </span>
            <div className="min-w-0 flex-1">
                <p className="ocs-eyebrow mb-0">Your moonling</p>
                <p className="mt-1 text-lg leading-6 font-semibold">
                    {progress.name}
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
                    Log time, file leave, or check a payslip to help it grow.
                </p>
            </div>
        </section>
    );
}
