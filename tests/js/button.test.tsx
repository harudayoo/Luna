import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// The kit (ocs.js) reads window and document.documentElement when it loads; nothing else runs here, since
// effects attach in refs and server rendering never calls refs. (vi.mock crashes under this runner.)
// Anime.js then takes this for a browser and wants an animation frame, which never runs here.
Object.assign(globalThis, {
    window: globalThis,
    document: { documentElement: {}, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
});
const { Button, effectsFor } = await import(
    '../../resources/js/components/ui/button'
);

/**
 * The kit's text effects (decode, wave) rewrite the text of `.ocs-btn-label`. An icon passed as `icon` sits
 * outside the label, so the effect can run without wiping the icon.
 */
describe('Button icon', () => {
    it('renders the icon outside the animated label', () => {
        const html = renderToStaticMarkup(
            createElement(
                Button,
                {
                    variant: 'code',
                    icon: createElement('svg', { 'data-testid': 'icon' }),
                },
                'Reword',
            ),
        );

        expect(html).toMatch(
            /<svg data-testid="icon"><\/svg><span class="ocs-btn-label[^"]*">Reword<\/span>/,
        );
    });
});

describe('effectsFor', () => {
    it('keeps decode for a plain-text label', () => {
        expect(effectsFor('code', { plainText: true })).toEqual([
            'decode',
            'squish',
        ]);
    });

    it('drops text effects when the label holds more than text', () => {
        expect(effectsFor('code', { plainText: false })).toEqual(['squish']);
        expect(effectsFor('secondary', { plainText: false })).toEqual([
            'squish',
        ]);
    });

    it('keeps only the press effect for asChild', () => {
        expect(
            effectsFor('default', { plainText: true, asChild: true }),
        ).toEqual(['squish']);
    });
});
