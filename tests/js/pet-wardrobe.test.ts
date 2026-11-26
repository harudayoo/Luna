import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PetSprite } from '../../resources/js/components/pet-sprite';
import {
    dyeColor,
    DYE_NAMES,
    DYES,
    KINDS,
    lockNote,
    PALETTE_NAMES,
    PALETTES,
    paletteStyle,
    SLOTS,
    toggleWear,
    WEAR,
} from '../../resources/js/lib/pet';
import { ITEM_LINES, itemLine } from '../../resources/js/lib/pet-voice';
import type {
    Dye,
    MoonlingKind,
    Palette,
    WearItem,
} from '../../resources/js/lib/pet';

// Shades (spec 2026-11-26-luna-moonling-style, slice 9) are fixed art colours: the same in both themes.
const HEX = /^#[0-9a-f]{6}$/;

describe('paletteStyle', () => {
    it('has the eighteen shades, the open ones first', () => {
        expect(PALETTES).toEqual([
            'classic',
            'dusk',
            'dawn',
            'tide',
            'mist',
            'mint',
            'coral',
            'lilac',
            'sakura',
            'ember',
            'frost',
            'cocoa',
            'midnight',
            'gold',
            'nebula',
            'ocean',
            'peach',
            'prism',
        ]);
    });

    it('gives every shade fixed colours (no theme token), with an outline', () => {
        for (const p of PALETTES) {
            const style = paletteStyle(p);
            expect(Object.keys(style).sort()).toEqual([
                '--pet-body',
                '--pet-face',
                '--pet-line',
                '--pet-mark',
            ]);
            for (const value of Object.values(style)) {
                expect(value).toMatch(HEX);
            }
        }
    });

    it('gives each shade its own body colour and a name', () => {
        const bodies = PALETTES.map((p) => paletteStyle(p)['--pet-body']);
        expect(new Set(bodies).size).toBe(PALETTES.length);
        for (const p of PALETTES) {
            expect(PALETTE_NAMES[p]).toBeTruthy();
        }
    });
});

describe('toggleWear', () => {
    it('puts an item on, swapping out whatever was in its slot', () => {
        expect(toggleWear([], 'bow')).toEqual(['bow']);
        expect(toggleWear(['bow'], 'halo')).toEqual(['halo']);
        expect(toggleWear(['bow'], 'scarf')).toEqual(['bow', 'scarf']);
        expect(toggleWear(['bow', 'scarf'], 'comet_trail')).toEqual([
            'bow',
            'comet_trail',
        ]);
    });

    it('takes an item off when it is already on', () => {
        expect(toggleWear(['bow', 'scarf'], 'bow')).toEqual(['scarf']);
    });

    it('knows each item’s slot', () => {
        expect(
            Object.fromEntries(
                Object.entries(WEAR).map(([k, v]) => [k, v.slot]),
            ),
        ).toEqual({
            star_clip: 'head',
            comet_trail: 'neck',
            halo: 'head',
            scarf: 'neck',
            bow: 'head',
            propeller: 'head',
            glasses: 'face',
            wings: 'back',
            cape: 'back',
            balloon: 'hand',
            wand: 'hand',
            lantern: 'hand',
            // Slice 15–18 collection, slice 16.
            jetpack: 'back',
            umbrella: 'hand',
            flower_crown: 'head',
            bowtie: 'neck',
            orchid_pin: 'head',
            coffee: 'hand',
            headphones: 'head',
            kite: 'hand',
            monocle: 'face',
        });
        expect(SLOTS).toEqual(['head', 'face', 'neck', 'back', 'hand']);
    });

    it('keeps one item in each of the five slots', () => {
        let wear: WearItem[] = [];
        for (const item of [
            'bow',
            'glasses',
            'scarf',
            'wings',
            'balloon',
        ] as WearItem[]) {
            wear = toggleWear(wear, item);
        }
        expect(wear).toEqual(['bow', 'glasses', 'scarf', 'wings', 'balloon']);
        expect(toggleWear(wear, 'cape')).toEqual([
            'bow',
            'glasses',
            'scarf',
            'balloon',
            'cape',
        ]);
        expect(toggleWear(wear, 'lantern')).toEqual([
            'bow',
            'glasses',
            'scarf',
            'wings',
            'lantern',
        ]);
    });
});

describe('dyes', () => {
    it('has the dyes, the open ones first and the seasonal ones last', () => {
        expect(DYES).toEqual([
            'default',
            'sun',
            'ruby',
            'leaf',
            'sky',
            'rose',
            'night',
            'starlight',
            'cloud',
            'berry',
            'gold',
            'silver',
            'bronze',
            'fiesta',
            'parol',
            'pumpkin',
            'pine',
            'heart',
        ]);
    });

    it('gives every item its own colour, and every dye a fixed one', () => {
        for (const item of Object.keys(WEAR) as WearItem[]) {
            expect(WEAR[item].color).toMatch(/^#[0-9a-f]{6}$/);
            expect(dyeColor('default', item)).toBe(WEAR[item].color);
            expect(dyeColor(undefined, item)).toBe(WEAR[item].color);
        }
        // A dye stored before slice 12 (`match`) reads as the item's own colour.
        expect(dyeColor('match' as Dye, 'scarf')).toBe(WEAR.scarf.color);
        const fixed = DYES.filter((d) => d !== 'default').map((d) =>
            dyeColor(d, 'scarf'),
        );
        fixed.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
        expect(new Set(fixed).size).toBe(fixed.length);
        for (const d of DYES) {
            expect(DYE_NAMES[d]).toBeTruthy();
        }
    });

    it('never changes an item’s colour with the shade', () => {
        const scarf = (palette: Palette) => {
            const s = renderToStaticMarkup(
                createElement(PetSprite, {
                    stage: 2,
                    title: 'x',
                    palette,
                    wear: ['scarf'],
                }),
            );

            return s.slice(s.indexOf('data-pet-wear="scarf"'));
        };
        expect(scarf('dusk')).toContain(`fill="${WEAR.scarf.color}"`);
        expect(scarf('mint')).toContain(`fill="${WEAR.scarf.color}"`);
    });
});

describe('item voice lines', () => {
    it('has at least two lines for every item, and never repeats one twice in a row', () => {
        for (const item of Object.keys(WEAR) as WearItem[]) {
            expect(ITEM_LINES[item].length).toBeGreaterThanOrEqual(2);
            const first = itemLine(item);
            expect(ITEM_LINES[item]).toContain(first);
            expect(itemLine(item, first)).not.toBe(first);
        }
    });
});

describe('PetSprite wardrobe', () => {
    const svg = (
        stage: number,
        kind: MoonlingKind,
        wear: WearItem[],
        crown = false,
    ) =>
        renderToStaticMarkup(
            createElement(PetSprite, {
                stage,
                kind,
                wear,
                crown,
                palette: 'dusk',
                title: 'x',
            }),
        );

    it('draws every item at every stage and kind, with the shade as CSS variables', () => {
        for (const item of Object.keys(WEAR) as WearItem[]) {
            for (const kind of Object.keys(KINDS) as MoonlingKind[]) {
                for (const stage of [0, 1, 2, 3, 4]) {
                    const s = svg(stage, kind, [item]);
                    expect(s).toContain(`data-pet-wear="${item}"`);
                    expect(s).toContain(
                        `--pet-body:${paletteStyle('dusk')['--pet-body']}`,
                    );
                }
            }
        }
    });

    it('outlines the body at every stage and kind, but not a locked silhouette', () => {
        for (const kind of Object.keys(KINDS) as MoonlingKind[]) {
            for (const stage of [0, 1, 2, 3, 4]) {
                expect(svg(stage, kind, [])).toMatch(
                    /<[^>]*data-pet-shape[^>]*stroke="var\(--pet-line\)"/,
                );
            }
        }
        const locked = renderToStaticMarkup(
            createElement(PetSprite, { stage: 2, title: 'x', locked: true }),
        );
        expect(locked).toContain('[&amp;_[data-pet-body]_*]:stroke-none');
    });

    it('puts a catchlight in each open eye, but not in the sparkle eyes', () => {
        const eyes = (mood?: 'glowing' | 'happy') =>
            renderToStaticMarkup(
                createElement(PetSprite, { stage: 2, title: 'x', mood }),
            ).match(/data-pet-catchlight/g)?.length ?? 0;
        expect(eyes('happy')).toBe(2);
        expect(eyes('glowing')).toBe(0);
    });

    it('draws an item in its dye, with an outline and its motion hooks', () => {
        const dyed = (item: WearItem, dye: Dye) =>
            renderToStaticMarkup(
                createElement(PetSprite, {
                    stage: 3,
                    title: 'x',
                    wear: [item],
                    dyes: { [item]: dye },
                }),
            );
        for (const item of Object.keys(WEAR) as WearItem[]) {
            const s = dyed(item, 'ruby');
            const part = s.slice(s.indexOf(`data-pet-wear="${item}"`));
            expect(part).toContain(dyeColor('ruby', item));
            expect(part).toContain('data-pet-wear-tap');
            expect(part).toContain('stroke="var(--pet-line)"');
        }
        for (const item of [
            'propeller',
            'wings',
            'cape',
            'balloon',
            'scarf',
            'lantern',
            'halo',
        ] as WearItem[]) {
            expect(dyed(item, 'sun')).toContain('data-pet-wear-idle');
        }
    });

    it('draws back items behind the body and the rest in front', () => {
        const s = svg(2, 'moon', ['wings', 'balloon']);
        const body = s.indexOf('data-pet-catchlight');
        expect(s.indexOf('data-pet-wear="wings"')).toBeLessThan(body);
        expect(s.indexOf('data-pet-wear="balloon"')).toBeGreaterThan(body);
    });

    it('lets the Moon Cup crown take the head slot, keeping the neck item', () => {
        const s = svg(2, 'moon', ['bow', 'scarf'], true);
        expect(s).toContain('data-pet-crown');
        expect(s).not.toContain('data-pet-wear="bow"');
        expect(s).toContain('data-pet-wear="scarf"');
    });
});

describe('lockNote', () => {
    it('shows what unlocks a swatch only while it is locked', () => {
        expect(
            lockNote({ unlocked: false, how: 'Reach a 20-day visit streak' }),
        ).toBe('Reach a 20-day visit streak');
        expect(
            lockNote({ unlocked: true, how: 'Reach a 20-day visit streak' }),
        ).toBeNull();
        expect(lockNote({ unlocked: true, how: null })).toBeNull();
        expect(lockNote(undefined)).toBeNull();
    });
});
