import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import InputError from '@/components/input-error';
import { PetSprite } from '@/components/pet-sprite';
import { Button } from '@/components/ui/button';
import type { PetNest as PetNestData } from '@/lib/pet';
import { KINDS, nestGroups, raiseState } from '@/lib/pet';

type Moonling = PetNestData['moonlings'][number];

const reduced = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Small stars in the night sky (positions in % of the scene). */
const STARS = [
    [6, 18],
    [17, 8],
    [31, 22],
    [46, 10],
    [58, 26],
    [72, 12],
    [84, 24],
    [93, 9],
];

/**
 * The moon nest (spec 2026-11-25-luna-moonling-life, slice 6): a night sky with a crescent cradle where your
 * moonlings rest, idling at different speeds, and your eggs in a small pile. Tap one to see it and raise it
 * (once the one you're raising has hatched). Below: the eggs you can still find. Loads when the tab opens; on
 * phones the scene scrolls sideways when the nest is full. Reduced motion: still.
 */
export function PetNest() {
    const { pet_nest: nest, errors } = usePage<{
        pet_nest?: PetNestData;
        errors: Record<string, string>;
    }>().props;
    const [picked, setPicked] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const scene = useRef<HTMLDivElement>(null);

    // Each resting moonling bobs at its own pace.
    useEffect(() => {
        const el = scene.current;
        if (!el || reduced()) {
            return;
        }
        const bobs = Array.from(
            el.querySelectorAll<HTMLElement>('[data-nest-rest]'),
        ).map((m, i) =>
            m.animate(
                [
                    { transform: 'translateY(0)' },
                    { transform: 'translateY(-5px)' },
                    { transform: 'translateY(0)' },
                ],
                {
                    duration: 2000 + ((i * 700) % 1900),
                    delay: i * 260,
                    iterations: Infinity,
                    easing: 'ease-in-out',
                },
            ),
        );

        return () => bobs.forEach((b) => b.cancel());
    }, [nest]);

    if (!nest) {
        return <p className="text-sm text-muted">Loading&hellip;</p>;
    }

    const { cradle, eggs } = nestGroups(nest.moonlings);
    const selected =
        nest.moonlings.find((m) => m.id === picked) ??
        nest.moonlings.find((m) => m.active);
    const raise = selected ? raiseState(nest, selected.id) : null;

    const raiseIt = (m: Moonling) =>
        router.patch(
            PetController.active(),
            { moonling_id: m.id },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['pet', 'pet_nest', 'errors'],
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
            },
        );

    const tile = (m: Moonling, size: string) => (
        <button
            key={m.id}
            type="button"
            aria-pressed={selected?.id === m.id}
            aria-label={`${m.name ?? KINDS[m.kind]}: ${KINDS[m.kind]} ${m.stage_name}${m.active ? ', the one you’re raising' : ''}`}
            onClick={() => setPicked(m.id)}
            className="flex shrink-0 cursor-pointer flex-col items-center gap-1 p-1 focus-visible:bg-surface focus-visible:outline-none aria-pressed:bg-surface/60"
        >
            <span data-nest-rest className="inline-block">
                <PetSprite
                    stage={m.stage}
                    kind={m.kind}
                    palette={m.palette}
                    wear={m.wear}
                    title={m.name ?? KINDS[m.kind]}
                    className={size}
                />
            </span>
            {m.active && (
                <span className="bg-primary px-1.5 text-[10px] leading-4 font-semibold text-on-primary">
                    Raising
                </span>
            )}
        </button>
    );

    return (
        <section aria-label="Moon nest" className="grid gap-4">
            <div
                ref={scene}
                className="relative overflow-x-auto"
                style={{
                    background:
                        'color-mix(in oklab, var(--color-primary) 16%, var(--color-bg))',
                }}
            >
                <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0 size-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                >
                    {STARS.map(([x, y]) => (
                        <circle
                            key={`${x}-${y}`}
                            cx={x}
                            cy={y}
                            r="0.8"
                            fill="var(--color-accent)"
                            opacity="0.7"
                        />
                    ))}
                    {/* The crescent cradle. */}
                    <path
                        d="M0 78 Q50 108 100 78 L100 100 L0 100 Z"
                        fill="var(--color-primary)"
                        opacity="0.35"
                    />
                </svg>
                <div className="relative flex min-w-max items-end gap-1 px-3 pt-10 pb-4">
                    {cradle.map((m) => tile(m, 'size-18 min-[390px]:size-20'))}
                    {eggs.length > 0 && (
                        <div
                            aria-label="Eggs"
                            role="group"
                            className="ml-2 flex items-end -space-x-3"
                        >
                            {eggs.map((m) => tile(m, 'size-14'))}
                        </div>
                    )}
                </div>
            </div>

            {selected && raise && (
                <div className="grid gap-2 bg-bg px-4 py-3">
                    <p className="text-lg leading-6 font-semibold">
                        {selected.name ?? `${KINDS[selected.kind]} moonling`}
                    </p>
                    <p className="text-sm text-muted">
                        {KINDS[selected.kind]} &middot; {selected.stage_name}
                    </p>
                    <div>
                        <Button
                            size="sm"
                            disabled={!raise.can || saving}
                            onClick={() => raiseIt(selected)}
                        >
                            Raise this one
                        </Button>
                    </div>
                    {raise.reason && (
                        <p className="text-xs text-muted">{raise.reason}</p>
                    )}
                    <InputError message={errors.moonling_id} />
                </div>
            )}

            <section aria-label="Eggs to find">
                <p className="ocs-eyebrow">Eggs to find</p>
                <ul className="grid gap-1">
                    {nest.eggs.map((e) => (
                        <li
                            key={e.kind}
                            className="flex items-center gap-3 bg-bg px-3 py-2 text-sm"
                        >
                            <PetSprite
                                stage={0}
                                kind={e.kind}
                                title={`${KINDS[e.kind]} egg`}
                                locked={!e.earned}
                                className="size-8"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">
                                    {KINDS[e.kind]} egg
                                </span>
                                <span className="block text-xs text-muted">
                                    {e.how}
                                </span>
                            </span>
                            <span
                                className={`shrink-0 text-xs ${e.earned ? 'font-semibold text-primary' : 'text-muted'}`}
                            >
                                {e.earned ? 'Found' : 'Not yet'}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
        </section>
    );
}
