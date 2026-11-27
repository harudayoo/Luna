import { router, usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import InputError from '@/components/input-error';
import { ItemIcon } from '@/components/pet-sprite';
import type { Dye, Palette, Pet, PetDetail, Slot, WearItem } from '@/lib/pet';
import {
    DYE_NAMES,
    dyeColor,
    knownItem,
    lockNote,
    PALETTE_NAMES,
    paletteStyle,
    SLOT_NAMES,
    SLOTS,
    toggleWear,
    WEAR,
} from '@/lib/pet';

/**
 * The wardrobe for the moonling you're raising (spec 2026-11-25-luna-moonling-life, slice 7; spec
 * 2026-11-26-luna-moonling-style, slices 9–10): a shade (fixed art colours; six open, the rest unlocked), one item
 * per slot (head, face, neck, back, hand) picked slot by slot, and a dye for a worn item. Locked ones say what
 * unlocks them. Each tap saves.
 */
export function PetWardrobe({
    pet,
    wardrobe,
    onWorn,
}: {
    pet: Pet;
    wardrobe: PetDetail['wardrobe'];
    /** An item went on (slice 8: the moonling says something about its new look). */
    onWorn?: () => void;
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [saving, setSaving] = useState(false);
    // The swatch last tapped (or the worn one): its name, and what unlocks it when it's locked.
    const [peek, setPeek] = useState<Palette>(pet.palette);
    const peeked =
        wardrobe.palettes.find((p) => p.key === peek) ?? wardrobe.palettes[0];
    const shadeNote = useId();
    const [slot, setSlot] = useState<Slot>('head');
    // The item whose dyes show: the one last tapped in this slot, else the one worn there.
    const [picked, setPicked] = useState<WearItem | null>(null);
    const items = wardrobe.items.filter((i) => knownItem(i.key));
    const inSlot = items.filter((i) => i.slot === slot);
    const worn = pet.wear.find((w) => knownItem(w) && WEAR[w].slot === slot);
    const dyeing =
        picked && WEAR[picked]?.slot === slot && pet.wear.includes(picked)
            ? picked
            : (worn ?? null);
    const [dyePeek, setDyePeek] = useState<Dye | null>(null);
    const dyeNote = useId();
    const peekedDye = wardrobe.dyes.find((d) => d.key === dyePeek);

    const save = (data: {
        palette?: Palette;
        wear?: WearItem[];
        dyes?: Partial<Record<WearItem, Dye>>;
    }) =>
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

            {/* Fourteen swatches in two rows of seven, so a phone sees them all at once; the line under them names the
                one in focus and, for a locked one, what unlocks it. */}
            <div
                role="radiogroup"
                aria-label="Shade"
                aria-describedby={shadeNote}
                className="grid grid-cols-7 gap-1.5"
            >
                {wardrobe.palettes.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={pet.palette === p.key}
                        aria-disabled={!p.unlocked || saving}
                        aria-label={`${PALETTE_NAMES[p.key]}${p.unlocked ? '' : ', locked'}`}
                        onClick={() => {
                            setPeek(p.key);
                            if (p.unlocked && !saving) {
                                save({ palette: p.key });
                            }
                        }}
                        className="relative grid aspect-square min-h-10 cursor-pointer place-items-center bg-bg p-1 focus-visible:shadow-lift focus-visible:outline-none aria-checked:bg-surface-hover aria-checked:shadow-lift"
                    >
                        <span
                            aria-hidden
                            className={`relative size-full ${p.unlocked ? '' : 'opacity-35 grayscale'}`}
                            style={
                                {
                                    ...paletteStyle(p.key),
                                    background: 'var(--pet-body)',
                                    boxShadow:
                                        'inset 0 0 0 2px var(--pet-line)',
                                } as CSSProperties
                            }
                        >
                            <span
                                className="absolute right-1 bottom-1 size-2"
                                style={{ background: 'var(--pet-mark)' }}
                            />
                        </span>
                        {!p.unlocked && (
                            <span
                                aria-hidden
                                className="absolute inset-0 grid place-items-center text-sm"
                            >
                                🔒
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <p id={shadeNote} className="-mt-1 text-xs text-muted">
                <span className="font-semibold text-ink">
                    {PALETTE_NAMES[peeked.key]}
                </span>
                {lockNote(peeked) ? ` · 🔒 ${lockNote(peeked)}` : ''}
            </p>

            {/* Items, one slot at a time, so a phone sees one short row instead of a long page. */}
            <div
                role="tablist"
                aria-label="Where it goes"
                className="grid grid-cols-5 gap-1"
            >
                {SLOTS.map((k) => (
                    <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={slot === k}
                        onClick={() => {
                            setSlot(k);
                            setPicked(null);
                            setDyePeek(null);
                        }}
                        className="min-h-10 cursor-pointer bg-bg px-1 text-xs font-semibold text-muted focus-visible:shadow-lift focus-visible:outline-none aria-selected:bg-surface-hover aria-selected:text-ink"
                    >
                        {SLOT_NAMES[k]}
                        {pet.wear.some(
                            (w) => knownItem(w) && WEAR[w].slot === k,
                        ) && (
                            <span aria-label=", wearing one" className="ml-1">
                                •
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <ul
                role="tabpanel"
                aria-label={SLOT_NAMES[slot]}
                className="grid grid-cols-2 gap-1 min-[390px]:grid-cols-3 sm:grid-cols-4"
            >
                {inSlot.map((item) => {
                    const on = pet.wear.includes(item.key);

                    return (
                        <li key={item.key}>
                            <button
                                type="button"
                                aria-pressed={on}
                                disabled={!item.unlocked || saving}
                                onClick={() => {
                                    setPicked(item.key);
                                    save({
                                        wear: toggleWear(pet.wear, item.key),
                                    });
                                    if (!on) {
                                        onWorn?.();
                                    }
                                }}
                                className="flex size-full min-h-24 cursor-pointer flex-col items-center gap-1 bg-bg px-2 py-2 text-center focus-visible:shadow-lift focus-visible:outline-none disabled:cursor-default aria-pressed:bg-surface-hover"
                            >
                                <ItemIcon
                                    item={item.key}
                                    dye={pet.dyes[item.key]}
                                    palette={pet.palette}
                                    locked={!item.unlocked}
                                    className="size-12"
                                />
                                <span className="text-xs font-semibold">
                                    {WEAR[item.key].label}
                                    <span className="sr-only">
                                        {on ? ', worn' : ''}
                                    </span>
                                </span>
                                {!item.unlocked && item.how && (
                                    <span className="text-[11px] leading-tight text-muted">
                                        🔒 {item.how}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            {dyeing && (
                <>
                    <div
                        role="radiogroup"
                        aria-label={`Dye for the ${WEAR[dyeing].label.toLowerCase()}`}
                        aria-describedby={dyeNote}
                        className="grid grid-cols-8 gap-1"
                    >
                        {wardrobe.dyes.map((d) => {
                            const current =
                                (pet.dyes[dyeing] ?? 'default') === d.key;

                            return (
                                <button
                                    key={d.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={current}
                                    aria-disabled={!d.unlocked || saving}
                                    aria-label={`${DYE_NAMES[d.key]}${d.unlocked ? '' : ', locked'}`}
                                    onClick={() => {
                                        setDyePeek(d.key);
                                        if (d.unlocked && !saving) {
                                            save({ dyes: { [dyeing]: d.key } });
                                        }
                                    }}
                                    className="relative grid aspect-square min-h-9 cursor-pointer place-items-center bg-bg p-1 focus-visible:shadow-lift focus-visible:outline-none aria-checked:bg-surface-hover aria-checked:shadow-lift"
                                >
                                    <span
                                        aria-hidden
                                        className={`size-full ${d.unlocked ? '' : 'opacity-35 grayscale'}`}
                                        style={
                                            {
                                                ...paletteStyle(pet.palette),
                                                background: dyeColor(
                                                    d.key,
                                                    dyeing,
                                                ),
                                                boxShadow:
                                                    'inset 0 0 0 2px var(--pet-line)',
                                            } as CSSProperties
                                        }
                                    />
                                    {!d.unlocked && (
                                        <span
                                            aria-hidden
                                            className="absolute inset-0 grid place-items-center text-xs"
                                        >
                                            🔒
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <p id={dyeNote} className="-mt-1 text-xs text-muted">
                        <span className="font-semibold text-ink">
                            {WEAR[dyeing].label}:{' '}
                            {
                                DYE_NAMES[
                                    peekedDye?.key ??
                                        pet.dyes[dyeing] ??
                                        'default'
                                ]
                            }
                        </span>
                        {lockNote(peekedDye)
                            ? ` · 🔒 ${lockNote(peekedDye)}`
                            : ''}
                    </p>
                </>
            )}
            <InputError
                message={errors.wear ?? errors.palette ?? errors.dyes}
            />
            {pet.crown && (
                <p className="text-xs text-muted">
                    👑 Your Moon Cup crown is on this week. It takes the head
                    slot until Monday.
                </p>
            )}
        </section>
    );
}
