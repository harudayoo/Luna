import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PetSprite } from '../../resources/js/components/pet-sprite';
import {
    KINDS,
    PALETTES,
    paletteStyle,
    toggleWear,
    WEAR,
} from '../../resources/js/lib/pet';
import type { MoonlingKind, WearItem } from '../../resources/js/lib/pet';

// The kit's own tokens (resources/ocs/tokens.css), defined in both themes. Not Tailwind's --color-* aliases: with
// `@theme inline` only the ones some CSS references exist at runtime (--color-ink, --color-muted don't).
const KIT = '(primary|accent|on-primary|on-accent|ink|muted|bg|surface)';
const TOKEN = new RegExp(`^var\\(--${KIT}\\)$`);
const MIX = new RegExp(
    `^color-mix\\(in oklab, var\\(--${KIT}\\) \\d+%, var\\(--${KIT}\\)\\)$`,
);

describe('paletteStyle', () => {
    it('has the five shades', () => {
        expect(PALETTES).toEqual(['classic', 'dusk', 'dawn', 'tide', 'mist']);
    });

    it('builds every shade from tokens only, so it works in both themes', () => {
        for (const p of PALETTES) {
            const style = paletteStyle(p);
            expect(Object.keys(style).sort()).toEqual([
                '--pet-body',
                '--pet-face',
                '--pet-mark',
            ]);
            for (const value of Object.values(style)) {
                expect(value).toMatch(
                    new RegExp(`${TOKEN.source}|${MIX.source}`),
                );
                expect(value).not.toMatch(/#|rgb|hsl|oklch\(/);
            }
        }
    });

    it('gives each shade its own body colour', () => {
        const bodies = PALETTES.map((p) => paletteStyle(p)['--pet-body']);
        expect(new Set(bodies).size).toBe(PALETTES.length);
        expect(paletteStyle('classic')['--pet-body']).toBe('var(--primary)');
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
        });
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
                    expect(s).toContain('--pet-body:color-mix');
                    expect(s).not.toMatch(/#[0-9a-f]{3,8}\b/i);
                }
            }
        }
    });

    it('lets the Moon Cup crown take the head slot, keeping the neck item', () => {
        const s = svg(2, 'moon', ['bow', 'scarf'], true);
        expect(s).toContain('data-pet-crown');
        expect(s).not.toContain('data-pet-wear="bow"');
        expect(s).toContain('data-pet-wear="scarf"');
    });
});
