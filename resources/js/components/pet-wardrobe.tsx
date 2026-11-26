import { router, usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import InputError from '@/components/input-error';
import { PetSprite } from '@/components/pet-sprite';
import type { Palette, Pet, PetDetail, WearItem } from '@/lib/pet';
import { PALETTE_NAMES, paletteStyle, toggleWear, WEAR } from '@/lib/pet';

/**
 * The wardrobe (spec 2026-11-25-luna-moonling-life, slice 7) for the moonling you're raising: a shade (all open)
 * and one head and one neck item from the ones you've unlocked; locked ones say what unlocks them. Each tap saves.
 */
export function PetWardrobe({
    pet,
    wardrobe,
}: {
    pet: Pet;
    wardrobe: PetDetail['wardrobe'];
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [saving, setSaving] = useState(false);

    const save = (data: { palette?: Palette; wear?: WearItem[] }) =>
        router.patch(PetController.dress(pet.moonling_id), data, {
            preserveScroll: true,
            preserveState: true,
            only: ['pet', 'pet_detail', 'errors'],
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
        });

    return (
        <section aria-label="Wardrobe" className="grid gap-3">
            <p className="ocs-eyebrow mb-0">Wardrobe</p>

            <div
                role="radiogroup"
                aria-label="Shade"
                className="flex flex-wrap gap-2"
            >
                {wardrobe.palettes.map((p) => (
                    <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={pet.palette === p}
                        disabled={saving}
                        onClick={() => save({ palette: p })}
                        className="flex min-h-10 cursor-pointer items-center gap-2 bg-bg px-2 py-1 text-xs font-semibold text-muted aria-checked:bg-surface-hover aria-checked:text-ink focus-visible:shadow-lift focus-visible:outline-none"
                    >
                        <span
                            aria-hidden
                            className="relative size-6"
                            style={
                                {
                                    ...paletteStyle(p),
                                    background: 'var(--pet-body)',
                                } as CSSProperties
                            }
                        >
                            <span
                                className="absolute right-0.5 bottom-0.5 size-2"
                                style={{ background: 'var(--pet-mark)' }}
                            />
                        </span>
                        {PALETTE_NAMES[p]}
                    </button>
                ))}
            </div>

            <ul className="grid grid-cols-2 gap-1 min-[390px]:grid-cols-3 sm:grid-cols-5">
                {wardrobe.items.map((item) => {
                    const on = pet.wear.includes(item.key);

                    return (
                        <li key={item.key}>
                            <button
                                type="button"
                                aria-pressed={on}
                                disabled={!item.unlocked || saving}
                                onClick={() =>
                                    save({
                                        wear: toggleWear(pet.wear, item.key),
                                    })
                                }
                                className="flex size-full min-h-24 cursor-pointer flex-col items-center gap-1 bg-bg px-2 py-2 text-center aria-pressed:bg-surface-hover focus-visible:shadow-lift focus-visible:outline-none disabled:cursor-default"
                            >
                                <PetSprite
                                    stage={Math.max(1, pet.stage)}
                                    kind={pet.kind}
                                    palette={pet.palette}
                                    wear={[item.key]}
                                    locked={!item.unlocked}
                                    title=""
                                    className="size-12"
                                />
                                <span className="text-xs font-semibold">
                                    {WEAR[item.key].label}
                                    <span className="sr-only">
                                        {on ? ', worn' : ''}
                                    </span>
                                </span>
                                <span className="text-[11px] leading-tight text-muted">
                                    {item.unlocked
                                        ? WEAR[item.key].slot === 'head'
                                            ? 'Head'
                                            : 'Neck'
                                        : item.how}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <InputError message={errors.wear ?? errors.palette} />
            {pet.crown && (
                <p className="text-xs text-muted">
                    👑 Your Moon Cup crown is on this week. It takes the head
                    slot until Monday.
                </p>
            )}
        </section>
    );
}
