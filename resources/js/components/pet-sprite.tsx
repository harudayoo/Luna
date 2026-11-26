/*
 * The pet, drawn in code (spec 2026-11-24-luna-pet): a little moon creature in five stages,
 * Egg · Hatchling · Moonling · Bright · Full Moon. Colours come from the shade (fixed art colours,
 * the same in both themes), with a cartoon outline and shading. Parts the motion (lib/ocs.ts petIdle / petFed / petGrow) moves: [data-pet-body],
 * [data-pet-eye], [data-pet-glow]. Swapping in commissioned art only changes this file.
 */
import type { CSSProperties } from 'react';
import { useId } from 'react';
import { dyeColor, knownItem, paletteStyle, WEAR } from '@/lib/pet';
import type {
    Dyes,
    MoodLevel,
    MoonlingKind,
    Palette,
    WearItem,
} from '@/lib/pet';

// The shade sets these on the svg: fixed art colours (lib/pet.ts paletteStyle, spec 2026-11-26-luna-moonling-style).
const PRIMARY = 'var(--pet-body)';
const ACCENT = 'var(--pet-mark)';
const FACE = 'var(--pet-face)';
const LINE = 'var(--pet-line)';

/**
 * The cartoon outline on a silhouette shape. Painted under the fill, so only its outer half shows; shapes are drawn
 * back to front, so the body covers the inner half of the arms' and feet's lines and the joins stay clean.
 * A locked silhouette drops it (the `stroke-none` class wins over the attribute).
 */
const INK = {
    'data-pet-shape': '',
    stroke: LINE,
    strokeWidth: 3.5,
    strokeLinejoin: 'round',
    paintOrder: 'stroke',
} as const;
const EYE = { transformBox: 'fill-box', transformOrigin: '50% 50%' } as const;

/** Body radius and glow per stage (the egg has neither). */
const SIZE = [0, 24, 32, 36, 40];
const GLOW = [0, 0, 0, 48, 56];

/** Sizes for the Home card (smaller in the desktop rail, so the rail fits on screen). */
const CARD_SIZE = 'size-24 min-[390px]:size-30 lg:size-20';

/**
 * `locked` draws a flat silhouette (every part in --color-surface-hover, no glow, no shadow): a stage
 * still ahead on the panel's growth path. `crown`: last week's Moon Cup champion. `mood`: the owner's
 * own pet only (sparkly eyes when glowing, sleepy when droopy or gloomy). The eyes sit in
 * [data-pet-gaze], which lib/pet-play moves to follow the pointer. `className` replaces the card sizes.
 */
export function PetSprite({
    stage,
    title,
    locked = false,
    crown = false,
    mood,
    kind = 'moon',
    palette = 'classic',
    wear = [],
    dyes = {},
    className = CARD_SIZE,
}: {
    stage: number;
    title: string;
    locked?: boolean;
    crown?: boolean;
    mood?: MoodLevel;
    /** Which kind of moonling (slice 6): its mark, and what it has around its body. */
    kind?: MoonlingKind;
    /** The wardrobe: a shade, one item per slot (head, face, neck, back, hand) and a dye per item. */
    palette?: Palette;
    wear?: WearItem[];
    dyes?: Dyes;
    className?: string;
}) {
    const r = SIZE[stage] ?? 40;
    const cy = 96 - r - 4;
    // The top of the head (the egg's tip), where the crown sits.
    const top = stage === 0 ? 32 : cy - r;
    // Where items sit, so they fit every stage and kind (the egg: its own shape).
    const egg = stage === 0;
    const fit = {
        wear,
        dyes,
        palette,
        crown,
        top,
        cy: egg ? 66 : cy,
        r: egg ? 26 : r,
        neck: egg ? 78 : cy + r * 0.45,
        half: egg ? 24 : r * 0.89,
        eyeY: egg ? 58 : cy - r * 0.1,
        eyeDx: egg ? 9 : r * 0.36,
        // The hands: on the arms from the Moonling on, else at the sides.
        handDx: egg ? 24 : stage >= 2 ? r + 2 : r - 2,
        handY: egg ? 76 : cy + r * 0.3,
    };

    return (
        <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={title}
            data-pet-kind={kind}
            style={paletteStyle(palette) as CSSProperties}
            className={`shrink-0 overflow-visible ${className} ${locked ? '[&_[data-pet-body]_*]:fill-surface-hover [&_[data-pet-body]_*]:stroke-none' : ''}`}
        >
            {!locked && GLOW[stage] > 0 && (
                <circle
                    data-pet-glow
                    cx="60"
                    cy={cy}
                    r={GLOW[stage]}
                    fill={PRIMARY}
                    opacity={stage === 4 ? 0.22 : 0.16}
                />
            )}
            {!locked && (
                <ellipse
                    cx="60"
                    cy="104"
                    rx={stage === 0 ? 22 : r * 0.8}
                    ry="4"
                    fill={ACCENT}
                    opacity="0.25"
                />
            )}
            <g
                data-pet-body
                style={{
                    transformBox: 'fill-box',
                    transformOrigin: '50% 100%',
                }}
            >
                {/* Back items (wings, cape) behind the body; the rest in front. */}
                {!locked && <Wear layer="back" {...fit} />}
                {stage === 0 ? (
                    <Egg kind={kind} />
                ) : (
                    <Body stage={stage} r={r} cy={cy} mood={mood} kind={kind} />
                )}
                {!locked && <Wear layer="front" {...fit} />}
                {crown && !locked && <Crown base={top + 4} />}
            </g>
            {!locked && stage === 4 && <Sparkles />}
        </svg>
    );
}

function Egg({ kind }: { kind: MoonlingKind }) {
    return (
        <>
            <ellipse {...INK} cx="60" cy="66" rx="26" ry="34" fill={PRIMARY} />
            <ellipse
                cx="50"
                cy="46"
                rx="7"
                ry="4"
                fill="#ffffff"
                opacity="0.45"
                transform="rotate(-30 50 46)"
            />
            <circle cx="50" cy="54" r="5" fill={ACCENT} opacity="0.55" />
            <circle cx="70" cy="76" r="4" fill={ACCENT} opacity="0.55" />
            <circle cx="66" cy="46" r="3" fill={ACCENT} opacity="0.55" />
            <path
                d="M38 64 l7 -5 l6 6 l7 -7 l6 6 l7 -6 l6 5"
                fill="none"
                stroke={FACE}
                strokeWidth="2.5"
                strokeLinejoin="miter"
            />
            {/* What will hatch: every kind but the moon shows its mark on the shell. */}
            {kind !== 'moon' && (
                <KindMark kind={kind} x={58} y={84} fill={FACE} />
            )}
        </>
    );
}

/** An n-pointed star path around (x, y), outer radius `r`, inner `r * inner`. */
const starPath = (x: number, y: number, r: number, n: number, inner: number) =>
    Array.from({ length: n * 2 }, (_, i) => {
        const a = (Math.PI * i) / n - Math.PI / 2;
        const d = i % 2 === 0 ? r : r * inner;
        return `${i === 0 ? 'M' : 'L'}${(x + d * Math.cos(a)).toFixed(2)} ${(y + d * Math.sin(a)).toFixed(2)}`;
    }).join(' ') + ' Z';

/** Each kind's small mark: on the forehead from the Moonling on, and on the egg's shell. */
function KindMark({
    kind,
    x,
    y,
    fill,
}: {
    kind: MoonlingKind;
    x: number;
    y: number;
    fill: string;
}) {
    switch (kind) {
        case 'star':
            return <path d={starPath(x, y, 7, 5, 0.45)} fill={fill} />;
        case 'comet':
            return (
                <>
                    <path
                        d={`M${x + 2} ${y - 3} L${x - 9} ${y - 7} L${x - 6} ${y} Z`}
                        fill={fill}
                        opacity="0.7"
                    />
                    <circle cx={x + 2} cy={y} r="4" fill={fill} />
                </>
            );
        case 'eclipse':
            return (
                <>
                    <circle
                        cx={x}
                        cy={y}
                        r="5.5"
                        fill="none"
                        stroke={fill}
                        strokeWidth="2.5"
                    />
                    <circle cx={x + 1.5} cy={y - 1} r="3" fill={fill} />
                </>
            );
        case 'aurora':
            return (
                <path
                    d={`M${x - 8} ${y + 2} q4 -7 8 0 t8 0`}
                    fill="none"
                    stroke={fill}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            );
        case 'nova':
            return <path d={starPath(x, y, 7, 8, 0.4)} fill={fill} />;
        default:
            // The moon's crescent.
            return (
                <path
                    d={`M${x - 5} ${y} a7 7 0 1 0 10 -1 a5.5 5.5 0 1 1 -10 1 z`}
                    fill={fill}
                />
            );
    }
}

/** What each kind has behind or around its body, from the Hatchling on. */
function KindBack({
    kind,
    r,
    cy,
}: {
    kind: MoonlingKind;
    r: number;
    cy: number;
}) {
    switch (kind) {
        case 'star':
            // Pointed ears.
            return (
                <>
                    {[-1, 1].map((side) => (
                        <path
                            key={side}
                            {...INK}
                            d={`M${60 + side * r * 0.8} ${cy - r * 0.35} L${60 + side * r * 0.6} ${cy - r - 10} L${60 + side * r * 0.15} ${cy - r * 0.85} Z`}
                            fill={PRIMARY}
                        />
                    ))}
                </>
            );
        case 'comet':
            // A swept tail behind it.
            return (
                <path
                    {...INK}
                    d={`M${60 - r * 0.5} ${cy + r * 0.3} Q${60 - r - 16} ${cy + r * 0.1} ${60 - r - 24} ${cy - r * 0.9} Q${60 - r - 4} ${cy - r * 0.1} ${60 - r * 0.2} ${cy - r * 0.55} Z`}
                    fill={ACCENT}
                    opacity="0.75"
                />
            );
        case 'eclipse':
            // A dark ring with a halo.
            return (
                <>
                    <circle
                        cx="60"
                        cy={cy}
                        r={r + 8}
                        fill={ACCENT}
                        opacity="0.18"
                    />
                    <circle
                        cx="60"
                        cy={cy}
                        r={r + 3}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth="3"
                    />
                </>
            );
        case 'aurora':
            // A soft wavy crest.
            return (
                <path
                    {...INK}
                    d={`M${60 - r * 0.6} ${cy - r * 0.7} q${r * 0.15} ${-r * 0.55} ${r * 0.3} ${-r * 0.2} q${r * 0.15} ${-r * 0.5} ${r * 0.3} ${-r * 0.2} q${r * 0.15} ${-r * 0.5} ${r * 0.3} ${-r * 0.15} q${r * 0.15} ${-r * 0.4} ${r * 0.3} ${r * 0.05} Z`}
                    fill={ACCENT}
                />
            );
        case 'nova':
            // A burst crown of rays.
            return (
                <path
                    {...INK}
                    d={starPath(60, cy, r + 9, 10, (r - 2) / (r + 9))}
                    fill={ACCENT}
                    opacity="0.8"
                />
            );
        default:
            return null;
    }
}

function Body({
    stage,
    r,
    cy,
    mood,
    kind,
}: {
    stage: number;
    r: number;
    cy: number;
    mood?: MoodLevel;
    kind: MoonlingKind;
}) {
    const eyeY = cy - r * 0.1;
    const eyeDx = r * 0.36;
    const sleepy = mood === 'droopy' || mood === 'gloomy';
    // Unique per sprite: the board and the nest draw many on one page.
    const clip = `pet-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return (
        <>
            <KindBack kind={kind} r={r} cy={cy} />
            {/* Arms from the Moonling on, feet on everything that hatched. */}
            {stage >= 2 && (
                <>
                    <ellipse
                        {...INK}
                        cx={60 - r - 2}
                        cy={cy + r * 0.25}
                        rx="6"
                        ry="9"
                        fill={PRIMARY}
                        transform={`rotate(25 ${60 - r - 2} ${cy + r * 0.25})`}
                    />
                    <ellipse
                        {...INK}
                        cx={60 + r + 2}
                        cy={cy + r * 0.25}
                        rx="6"
                        ry="9"
                        fill={PRIMARY}
                        transform={`rotate(-25 ${60 + r + 2} ${cy + r * 0.25})`}
                    />
                </>
            )}
            <ellipse
                {...INK}
                cx={60 - r * 0.4}
                cy={cy + r}
                rx="7"
                ry="4"
                fill={PRIMARY}
            />
            <ellipse
                {...INK}
                cx={60 + r * 0.4}
                cy={cy + r}
                rx="7"
                ry="4"
                fill={PRIMARY}
            />
            <circle {...INK} cx="60" cy={cy} r={r} fill={PRIMARY} />
            {/* Cartoon shading: a shade on the lower right (the body minus a circle up and left), and a highlight. */}
            <clipPath id={clip}>
                <circle cx="60" cy={cy} r={r} />
            </clipPath>
            <path
                clipPath={`url(#${clip})`}
                fillRule="evenodd"
                d={`M${60 - r} ${cy - r} h${2 * r} v${2 * r} h${-2 * r} Z M${60 - r * 0.18} ${cy - r * 0.18} m${-r * 1.02} 0 a${r * 1.02} ${r * 1.02} 0 1 0 ${r * 2.04} 0 a${r * 1.02} ${r * 1.02} 0 1 0 ${-r * 2.04} 0 Z`}
                fill={LINE}
                opacity="0.16"
            />
            <ellipse
                cx={60 - r * 0.42}
                cy={cy - r * 0.5}
                rx={r * 0.26}
                ry={r * 0.14}
                fill="#ffffff"
                opacity="0.45"
                transform={`rotate(-35 ${60 - r * 0.42} ${cy - r * 0.5})`}
            />
            {/* Craters on the Full Moon. */}
            {stage === 4 && (
                <>
                    <circle
                        cx={60 - r * 0.5}
                        cy={cy + r * 0.45}
                        r="5"
                        fill={FACE}
                        opacity="0.14"
                    />
                    <circle
                        cx={60 + r * 0.55}
                        cy={cy - r * 0.45}
                        r="4"
                        fill={FACE}
                        opacity="0.14"
                    />
                    <circle
                        cx={60 + r * 0.25}
                        cy={cy + r * 0.62}
                        r="3"
                        fill={FACE}
                        opacity="0.14"
                    />
                </>
            )}
            {/* The kind's mark on the forehead, from the Moonling on (the moon's crescent). */}
            {stage >= 2 && (
                <KindMark kind={kind} x={60} y={cy - r * 0.62} fill={ACCENT} />
            )}
            {stage >= 3 && (
                <>
                    <ellipse
                        cx={60 - eyeDx - 6}
                        cy={eyeY + 9}
                        rx="5"
                        ry="3"
                        fill={ACCENT}
                        opacity="0.6"
                    />
                    <ellipse
                        cx={60 + eyeDx + 6}
                        cy={eyeY + 9}
                        rx="5"
                        ry="3"
                        fill={ACCENT}
                        opacity="0.6"
                    />
                </>
            )}
            <g data-pet-gaze>
                {[60 - eyeDx, 60 + eyeDx].map((x) =>
                    mood === 'glowing' ? (
                        <path
                            key={x}
                            data-pet-eye
                            style={EYE}
                            d={`M${x} ${eyeY - 5} L${x + 1.4} ${eyeY - 1.4} L${x + 4} ${eyeY} L${x + 1.4} ${eyeY + 1.4} L${x} ${eyeY + 5} L${x - 1.4} ${eyeY + 1.4} L${x - 4} ${eyeY} L${x - 1.4} ${eyeY - 1.4} Z`}
                            fill={FACE}
                        />
                    ) : (
                        <g key={x} data-pet-eye style={EYE}>
                            <ellipse
                                cx={x}
                                cy={sleepy ? eyeY + 1.5 : eyeY}
                                rx={sleepy ? 4 : 3.5}
                                ry={sleepy ? 1.4 : 4.5}
                                fill={FACE}
                            />
                            {/* An anime catchlight, on open eyes only. */}
                            {!sleepy && (
                                <circle
                                    data-pet-catchlight
                                    cx={x + 1.2}
                                    cy={eyeY - 1.8}
                                    r="1.3"
                                    fill="#ffffff"
                                />
                            )}
                        </g>
                    ),
                )}
            </g>
            <path
                d={
                    mood === 'droopy'
                        ? `M${60 - 4} ${eyeY + 10} h8`
                        : mood === 'gloomy'
                          ? `M${60 - 4} ${eyeY + 11} q4 -3 8 0`
                          : `M${60 - 5} ${eyeY + 8} q5 5 10 0`
                }
                fill="none"
                stroke={FACE}
                strokeWidth="2.2"
                strokeLinecap="round"
            />
            {/* The hatchling still wears its shell. */}
            {stage === 1 && (
                <path
                    {...INK}
                    d={`M${60 - r - 4} ${cy + 6} l7 -6 l6 6 l7 -6 l6 6 l7 -6 l6 6 l7 -6 l6 6 l${2 * r + 8 - 52} 0 v${r - 2} a${r + 4} 10 0 0 1 ${-(2 * r + 8)} 0 z`}
                    fill={ACCENT}
                />
            )}
        </>
    );
}

/** The Moon Cup crown: three points and a gem, tipped a little, its base on the head. */
function Crown({ base }: { base: number }) {
    return (
        <g data-pet-crown transform={`rotate(-8 60 ${base})`}>
            <path
                d={`M47 ${base} V${base - 9} L53.5 ${base - 4} L60 ${base - 13} L66.5 ${base - 4} L73 ${base - 9} V${base} Z`}
                fill={ACCENT}
            />
            <circle cx="60" cy={base - 3} r="2" fill={FACE} />
        </g>
    );
}

function Sparkles() {
    const star = (x: number, y: number, s: number) =>
        `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`;

    return (
        <g data-pet-glow fill={ACCENT}>
            <path d={star(14, 22, 6)} />
            <path d={star(106, 30, 5)} />
            <path d={star(100, 88, 4)} />
        </g>
    );
}

/** A thinner cartoon outline for items. */
const INK_THIN = { ...INK, strokeWidth: 2.5 } as const;

/** A part that moves around its own box (anime.js transforms), from `origin`. */
const box = (origin = '50% 50%') =>
    ({ transformBox: 'fill-box', transformOrigin: origin }) as const;

/**
 * The wardrobe's items (spec 2026-11-26-luna-moonling-style, slice 10), each in its dye with an outline, placed from
 * the head's top, the eyes, the neck line and the hands so they fit every stage and kind. Each item's root carries
 * its tap move (`data-pet-wear-tap`); a part that loops while idle carries `data-pet-wear-idle` (lib/ocs.ts), on a
 * different element so the two never fight. The Moon Cup crown takes the head slot in its week. Items this page
 * doesn't know (added on the server first) are skipped.
 */
function Wear({
    layer,
    wear,
    dyes,
    palette,
    crown,
    top,
    cy,
    r,
    neck,
    half,
    eyeY,
    eyeDx,
    handDx,
    handY,
}: {
    layer: 'back' | 'front';
    wear: WearItem[];
    dyes: Dyes;
    palette: Palette;
    crown: boolean;
    top: number;
    cy: number;
    r: number;
    neck: number;
    half: number;
    eyeY: number;
    eyeDx: number;
    handDx: number;
    handY: number;
}) {
    const shown = wear.filter(
        (w) =>
            knownItem(w) &&
            (WEAR[w].slot === 'back') === (layer === 'back') &&
            !(crown && WEAR[w].slot === 'head'),
    );

    return (
        <>
            {shown.map((item) => {
                const c = dyeColor(dyes[item], item);
                const root = (tap: string, origin?: string) => ({
                    'data-pet-wear': item,
                    'data-pet-wear-tap': tap,
                    style: box(origin),
                });

                switch (item) {
                    case 'star_clip':
                        return (
                            <path
                                key={item}
                                {...root('twinkle')}
                                {...INK_THIN}
                                d={starPath(
                                    60 + half * 0.45,
                                    top + 6,
                                    6.5,
                                    5,
                                    0.45,
                                )}
                                fill={c}
                            />
                        );
                    case 'halo': {
                        const rx = Math.max(12, half * 0.55);
                        return (
                            <g key={item} {...root('flare')}>
                                <g data-pet-wear-idle="float" style={box()}>
                                    <ellipse
                                        cx="60"
                                        cy={top - 8}
                                        rx={rx}
                                        ry="4"
                                        fill="none"
                                        stroke={LINE}
                                        strokeWidth="6"
                                    />
                                    <ellipse
                                        cx="60"
                                        cy={top - 8}
                                        rx={rx}
                                        ry="4"
                                        fill="none"
                                        stroke={c}
                                        strokeWidth="3"
                                    />
                                </g>
                            </g>
                        );
                    }
                    case 'bow': {
                        const x = 60 - half * 0.45;
                        const y = top + 6;
                        return (
                            <g key={item} {...root('wiggle')}>
                                <path
                                    {...INK_THIN}
                                    d={`M${x} ${y} L${x - 9} ${y - 7} L${x - 9} ${y + 7} Z M${x} ${y} L${x + 9} ${y - 7} L${x + 9} ${y + 7} Z`}
                                    fill={c}
                                />
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="2.8"
                                    fill={c}
                                    stroke={LINE}
                                    strokeWidth="1.5"
                                />
                            </g>
                        );
                    }
                    case 'propeller': {
                        const w = Math.max(11, half * 0.55);
                        const y = top + 5;
                        return (
                            <g key={item} {...root('spin')}>
                                <path
                                    {...INK_THIN}
                                    d={`M${60 - w} ${y} A${w} ${w * 0.8} 0 0 1 ${60 + w} ${y} Z`}
                                    fill={c}
                                />
                                <path
                                    d={`M60 ${y - w * 0.8} V${y}`}
                                    stroke="#ffffff"
                                    strokeOpacity="0.6"
                                    strokeWidth="2.5"
                                />
                                <path
                                    d={`M60 ${y - w * 0.8} v-5`}
                                    stroke={LINE}
                                    strokeWidth="2"
                                />
                                <g data-pet-wear-idle="spin" style={box()}>
                                    <ellipse
                                        {...INK_THIN}
                                        cx="60"
                                        cy={y - w * 0.8 - 6}
                                        rx="12"
                                        ry="2.6"
                                        fill={c}
                                    />
                                </g>
                            </g>
                        );
                    }
                    case 'glasses': {
                        const lens = Math.max(5.5, eyeDx * 0.62);
                        return (
                            <g key={item} {...root('glint')}>
                                {[60 - eyeDx, 60 + eyeDx].map((x) => (
                                    <circle
                                        key={x}
                                        cx={x}
                                        cy={eyeY}
                                        r={lens}
                                        fill="#ffffff"
                                        fillOpacity="0.18"
                                        stroke={LINE}
                                        strokeWidth="4.5"
                                    />
                                ))}
                                {[60 - eyeDx, 60 + eyeDx].map((x) => (
                                    <circle
                                        key={`c${x}`}
                                        cx={x}
                                        cy={eyeY}
                                        r={lens}
                                        fill="none"
                                        stroke={c}
                                        strokeWidth="2.2"
                                    />
                                ))}
                                <path
                                    d={`M${60 - eyeDx + lens} ${eyeY} Q60 ${eyeY - 3} ${60 + eyeDx - lens} ${eyeY}`}
                                    fill="none"
                                    stroke={c}
                                    strokeWidth="2.2"
                                />
                            </g>
                        );
                    }
                    case 'scarf':
                        return (
                            <g key={item} {...root('wiggle')}>
                                <path
                                    {...INK_THIN}
                                    d={`M${60 - half} ${neck - 3} Q60 ${neck + 3} ${60 + half} ${neck - 3} L${60 + half} ${neck + 4} Q60 ${neck + 10} ${60 - half} ${neck + 4} Z`}
                                    fill={c}
                                />
                                <g
                                    data-pet-wear-idle="sway"
                                    style={box('50% 0%')}
                                >
                                    <path
                                        {...INK_THIN}
                                        d={`M${60 + half * 0.4} ${neck + 4} l5 13 l7 -2 l-5 -12 Z`}
                                        fill={c}
                                    />
                                </g>
                            </g>
                        );
                    case 'comet_trail':
                        return (
                            <g key={item} data-pet-wear={item}>
                                <path
                                    d={`M${60 - half * 0.6} ${neck - 2} Q60 ${neck + 6} ${60 + half * 0.6} ${neck - 2}`}
                                    fill="none"
                                    stroke={LINE}
                                    strokeWidth="1.8"
                                />
                                <g data-pet-wear-tap="twinkle" style={box()}>
                                    <path
                                        {...INK_THIN}
                                        d={`M58 ${neck + 4} L48 ${neck - 1} L52 ${neck + 8} Z`}
                                        fill={c}
                                    />
                                    <circle
                                        {...INK_THIN}
                                        cx="60"
                                        cy={neck + 6}
                                        r="3.8"
                                        fill={c}
                                    />
                                </g>
                            </g>
                        );
                    case 'wings':
                        return (
                            <g key={item} {...root('flutter')}>
                                {[-1, 1].map((side) => {
                                    const ax = 60 + side * r * 0.7;
                                    const ay = cy - r * 0.15;
                                    return (
                                        <g
                                            key={side}
                                            data-pet-wear-idle="flap"
                                            style={box(
                                                side < 0
                                                    ? '100% 60%'
                                                    : '0% 60%',
                                            )}
                                        >
                                            <path
                                                {...INK_THIN}
                                                d={`M${ax} ${ay} C${ax + side * 18} ${ay - 24} ${ax + side * 32} ${ay - 8} ${ax + side * 22} ${ay + 8} C${ax + side * 15} ${ay + 13} ${ax + side * 6} ${ay + 9} ${ax} ${ay + 5} Z`}
                                                fill={c}
                                            />
                                            <path
                                                d={`M${ax + side * 6} ${ay - 2} q${side * 9} -8 ${side * 17} -4`}
                                                fill="none"
                                                stroke="#ffffff"
                                                strokeOpacity="0.55"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    case 'cape':
                        return (
                            <g key={item} {...root('billow', '50% 0%')}>
                                <g
                                    data-pet-wear-idle="sway"
                                    style={box('50% 0%')}
                                >
                                    <path
                                        {...INK_THIN}
                                        d={`M${60 - half * 0.8} ${neck - 4} L${60 + half * 0.8} ${neck - 4} L${60 + r * 1.08} ${cy + r * 0.95} Q60 ${cy + r * 1.18} ${60 - r * 1.08} ${cy + r * 0.95} Z`}
                                        fill={c}
                                    />
                                </g>
                            </g>
                        );
                    case 'balloon': {
                        const hx = 60 + handDx;
                        const bx = hx + 7;
                        const by = Math.max(12, top - 4);
                        return (
                            <g key={item} {...root('jump')}>
                                <g
                                    data-pet-wear-idle="bob"
                                    style={box('50% 100%')}
                                >
                                    <path
                                        d={`M${hx} ${handY} Q${hx + 6} ${(handY + by) / 2} ${bx} ${by + 11}`}
                                        fill="none"
                                        stroke={LINE}
                                        strokeWidth="1.5"
                                    />
                                    <ellipse
                                        {...INK_THIN}
                                        cx={bx}
                                        cy={by}
                                        rx="9"
                                        ry="11"
                                        fill={c}
                                    />
                                    <path
                                        d={`M${bx - 2} ${by + 13} h4 l-2 -3 Z`}
                                        fill={c}
                                        stroke={LINE}
                                        strokeWidth="1"
                                    />
                                    <ellipse
                                        cx={bx - 3}
                                        cy={by - 4}
                                        rx="2.5"
                                        ry="3.5"
                                        fill="#ffffff"
                                        opacity="0.55"
                                    />
                                </g>
                            </g>
                        );
                    }
                    case 'wand': {
                        const hx = 60 + handDx;
                        const tx = hx + 10;
                        const ty = handY - 16;
                        return (
                            <g key={item} data-pet-wear={item}>
                                <path
                                    d={`M${hx - 1} ${handY + 2} L${tx} ${ty}`}
                                    stroke={LINE}
                                    strokeWidth="4.5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d={`M${hx - 1} ${handY + 2} L${tx} ${ty}`}
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                                <path
                                    data-pet-wear-tap="burst"
                                    style={box()}
                                    {...INK_THIN}
                                    d={starPath(tx, ty, 7, 5, 0.45)}
                                    fill={c}
                                />
                            </g>
                        );
                    }
                    case 'lantern': {
                        const hx = 60 - handDx;
                        const ly = handY + 6;
                        return (
                            <g key={item} {...root('flare', '50% 0%')}>
                                <path
                                    d={`M${hx} ${handY} V${ly}`}
                                    stroke={LINE}
                                    strokeWidth="2"
                                />
                                <circle
                                    data-pet-wear-idle="flicker"
                                    style={box()}
                                    cx={hx}
                                    cy={ly + 8}
                                    r="12"
                                    fill="#fff3b0"
                                    opacity="0.55"
                                />
                                <rect
                                    {...INK_THIN}
                                    x={hx - 6}
                                    y={ly}
                                    width="12"
                                    height="15"
                                    fill={c}
                                />
                                <rect
                                    x={hx - 3}
                                    y={ly + 3}
                                    width="6"
                                    height="9"
                                    fill="#fff3b0"
                                />
                            </g>
                        );
                    }
                    default:
                        return null;
                }
            })}
        </>
    );
}
