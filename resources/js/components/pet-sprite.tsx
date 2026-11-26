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
            {/* Drawn half again as big, so it still reads on a small egg (the Nest's list). */}
            {kind !== 'moon' && (
                <g transform="translate(58 82) scale(1.5) translate(-58 -82)">
                    <KindMark kind={kind} x={58} y={82} fill={FACE} />
                </g>
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
        case 'sun':
            // A small sun: a disc and eight rays.
            return (
                <>
                    <circle cx={x} cy={y} r="3.6" fill={fill} />
                    {Array.from({ length: 8 }, (_, i) => {
                        const a = (Math.PI * i) / 4;
                        return (
                            <path
                                key={i}
                                d={`M${x + 5 * Math.cos(a)} ${y + 5 * Math.sin(a)} L${x + 7.5 * Math.cos(a)} ${y + 7.5 * Math.sin(a)}`}
                                stroke={fill}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                            />
                        );
                    })}
                </>
            );
        case 'planet':
            // A ball with a tilted ring.
            return (
                <>
                    <circle cx={x} cy={y} r="3.8" fill={fill} />
                    <ellipse
                        cx={x}
                        cy={y}
                        rx="7.5"
                        ry="2.2"
                        fill="none"
                        stroke={fill}
                        strokeWidth="1.6"
                        transform={`rotate(-20 ${x} ${y})`}
                    />
                </>
            );
        case 'meteor':
            // A rock with three streaks behind it.
            return (
                <>
                    {[-3, 0, 3].map((dy) => (
                        <path
                            key={dy}
                            d={`M${x + 1} ${y + dy * 0.6} l7 ${-4 + dy * 0.3}`}
                            stroke={fill}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            opacity="0.7"
                        />
                    ))}
                    <circle cx={x - 1} cy={y + 1} r="3.6" fill={fill} />
                </>
            );
        case 'galaxy':
            // A two-armed swirl.
            return (
                <path
                    d={`M${x} ${y} m-1 0 a1.5 1.5 0 1 1 3 0 a3 3 0 1 1 -6 0 a4.5 4.5 0 1 1 9 0 a6 6 0 1 1 -12 0`}
                    fill="none"
                    stroke={fill}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                />
            );
        case 'orchid':
            // Three petals and a lip.
            return (
                <>
                    {[-55, 0, 55].map((deg) => (
                        <ellipse
                            key={deg}
                            cx={x}
                            cy={y - 4}
                            rx="2.4"
                            ry="4.2"
                            fill={fill}
                            transform={`rotate(${deg} ${x} ${y})`}
                        />
                    ))}
                    <circle cx={x} cy={y + 1.5} r="2.2" fill={fill} />
                </>
            );
        case 'moonflower':
            // Five round petals around a centre.
            return (
                <>
                    {Array.from({ length: 5 }, (_, i) => {
                        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                        return (
                            <circle
                                key={i}
                                cx={x + 4 * Math.cos(a)}
                                cy={y + 4 * Math.sin(a)}
                                r="2.4"
                                fill={fill}
                                opacity="0.85"
                            />
                        );
                    })}
                    <circle cx={x} cy={y} r="1.8" fill={fill} />
                </>
            );
        case 'citylight':
            // A tiny skyline of three towers.
            return (
                <path
                    d={`M${x - 7} ${y + 4} v-5 h3 v-3 h3 v8 h1 v-10 h3 v10 h1 v-6 h3 v6 Z`}
                    fill={fill}
                />
            );
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
        case 'sun':
            // Many short rays all round.
            return (
                <path
                    {...INK}
                    d={starPath(60, cy, r + 7, 16, (r + 1) / (r + 7))}
                    fill={ACCENT}
                />
            );
        case 'planet':
            // A tilted ring behind it.
            return (
                <ellipse
                    cx="60"
                    cy={cy + r * 0.1}
                    rx={r + 15}
                    ry={r * 0.32}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="5"
                    transform={`rotate(-14 60 ${cy})`}
                    opacity="0.9"
                />
            );
        case 'meteor':
            // A fiery streak trailing up and right.
            return (
                <>
                    {[0, 1, 2].map((i) => (
                        <path
                            key={i}
                            {...(i === 0 ? INK : {})}
                            d={`M${60 + r * 0.3} ${cy - r * (0.2 + i * 0.25)} Q${60 + r + 10} ${cy - r * (0.9 + i * 0.2)} ${60 + r + 22 - i * 4} ${cy - r - 12 + i * 3} Q${60 + r * 0.8} ${cy - r * (0.4 + i * 0.25)} ${60 + r * 0.1} ${cy + r * (0.1 - i * 0.25)} Z`}
                            fill={ACCENT}
                            opacity={1 - i * 0.25}
                        />
                    ))}
                </>
            );
        case 'galaxy':
            // Two swirling arms of stars.
            return (
                <g opacity="0.75">
                    {[0, 180].map((deg) => (
                        <path
                            key={deg}
                            d={`M60 ${cy} m${-r - 6} 0 a${r + 6} ${r * 0.7} 0 0 1 ${r + 6} ${-r * 0.7} a${r * 0.9} ${r * 0.6} 0 0 1 ${r * 0.9} ${r * 0.6}`}
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth="4"
                            strokeLinecap="round"
                            transform={`rotate(${deg} 60 ${cy})`}
                        />
                    ))}
                    {[
                        [-r - 10, -4],
                        [r + 9, 6],
                        [-6, -r - 9],
                        [8, r + 6],
                    ].map(([dx, dy]) => (
                        <path
                            key={`${dx}${dy}`}
                            d={starPath(60 + dx, cy + dy, 3.5, 4, 0.4)}
                            fill={ACCENT}
                        />
                    ))}
                </g>
            );
        case 'orchid':
            // An orchid's petals as a crest on top of the head.
            return (
                <>
                    {[-38, 0, 38].map((deg) => (
                        <ellipse
                            key={deg}
                            {...INK}
                            cx="60"
                            cy={cy - r - 2}
                            rx={r * 0.22}
                            ry={r * 0.42}
                            fill={ACCENT}
                            transform={`rotate(${deg} 60 ${cy - r * 0.7})`}
                        />
                    ))}
                </>
            );
        case 'moonflower':
            // A ring of round petals, the moonling as the flower's heart.
            return (
                <>
                    {Array.from({ length: 8 }, (_, i) => {
                        const a = (Math.PI * 2 * i) / 8;
                        return (
                            <circle
                                key={i}
                                {...INK}
                                cx={60 + r * 0.92 * Math.cos(a)}
                                cy={cy + r * 0.92 * Math.sin(a)}
                                r={r * 0.42}
                                fill={ACCENT}
                            />
                        );
                    })}
                </>
            );
        case 'citylight':
            // A little Orchid City skyline on the head, its windows lit.
            return (
                <>
                    {[
                        [-0.62, 0.35, 0.26],
                        [-0.3, 0.7, 0.24],
                        [0.02, 0.5, 0.26],
                        [0.34, 0.85, 0.22],
                    ].map(([dx, h, w]) => (
                        <g key={dx}>
                            <rect
                                {...INK}
                                x={60 + r * dx}
                                y={cy - r * 0.55 - r * h}
                                width={r * w}
                                height={r * h + 4}
                                fill={ACCENT}
                            />
                            <rect
                                x={60 + r * dx + r * w * 0.3}
                                y={cy - r * 0.55 - r * h + 3}
                                width={r * w * 0.4}
                                height="2.5"
                                fill="#ffffff"
                                opacity="0.85"
                            />
                        </g>
                    ))}
                </>
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
                    case 'jetpack':
                        return (
                            <g key={item} {...root('jump')}>
                                {[-1, 1].map((side) => (
                                    <g key={side}>
                                        <rect
                                            {...INK_THIN}
                                            x={60 + side * r * 0.62 - r * 0.17}
                                            y={cy - r * 0.45}
                                            width={r * 0.34}
                                            height={r * 0.85}
                                            rx="3"
                                            fill={c}
                                        />
                                        <path
                                            data-pet-wear-idle="flicker"
                                            style={box('50% 0%')}
                                            d={`M${60 + side * r * 0.62 - 4} ${cy + r * 0.42} q4 14 8 0 q-4 5 -8 0 Z`}
                                            fill="#ffb347"
                                        />
                                    </g>
                                ))}
                            </g>
                        );
                    case 'umbrella': {
                        const hx = 60 + handDx;
                        const ux = hx + 4;
                        const uy = Math.max(18, handY - 30);
                        return (
                            <g key={item} data-pet-wear={item}>
                                <path
                                    d={`M${hx} ${handY + 2} L${ux} ${uy}`}
                                    stroke={LINE}
                                    strokeWidth="2"
                                />
                                <g
                                    data-pet-wear-idle="sway"
                                    style={box('50% 100%')}
                                >
                                    <path
                                        {...INK_THIN}
                                        d={`M${ux - 15} ${uy} a15 12 0 0 1 30 0 q-5 -3 -10 0 q-5 -3 -10 0 q-5 -3 -10 0 Z`}
                                        fill={c}
                                    />
                                </g>
                                <g data-pet-wear-tap="drip" style={box()}>
                                    {[-10, 0, 10].map((dx) => (
                                        <path
                                            key={dx}
                                            d={`M${ux + dx} ${uy + 4} q-2 3 0 4 q2 -1 0 -4 Z`}
                                            fill="#9fd3ff"
                                        />
                                    ))}
                                </g>
                            </g>
                        );
                    }
                    case 'flower_crown':
                        return (
                            <g key={item} {...root('wiggle')}>
                                <g
                                    data-pet-wear-idle="sway"
                                    style={box('50% 100%')}
                                >
                                    {[-2, -1, 0, 1, 2].map((i) => {
                                        const fx = 60 + i * half * 0.32;
                                        const fy = top + 3 + Math.abs(i) * 2.5;
                                        return (
                                            <g key={i}>
                                                <circle
                                                    {...INK_THIN}
                                                    cx={fx}
                                                    cy={fy}
                                                    r="4.2"
                                                    fill={c}
                                                />
                                                <circle
                                                    cx={fx}
                                                    cy={fy}
                                                    r="1.6"
                                                    fill="#fff6c2"
                                                />
                                            </g>
                                        );
                                    })}
                                </g>
                            </g>
                        );
                    case 'bowtie':
                        return (
                            <g key={item} {...root('spin')}>
                                <path
                                    {...INK_THIN}
                                    d={`M60 ${neck + 1} L50 ${neck - 5} L50 ${neck + 7} Z M60 ${neck + 1} L70 ${neck - 5} L70 ${neck + 7} Z`}
                                    fill={c}
                                />
                                <circle
                                    cx="60"
                                    cy={neck + 1}
                                    r="2.8"
                                    fill={c}
                                    stroke={LINE}
                                    strokeWidth="1.5"
                                />
                            </g>
                        );
                    case 'orchid_pin': {
                        const x = 60 + half * 0.48;
                        const y = top + 7;
                        return (
                            <g key={item} {...root('twinkle')}>
                                {[-55, 0, 55].map((deg) => (
                                    <ellipse
                                        key={deg}
                                        {...INK_THIN}
                                        cx={x}
                                        cy={y - 4}
                                        rx="2.6"
                                        ry="4.5"
                                        fill={c}
                                        transform={`rotate(${deg} ${x} ${y})`}
                                    />
                                ))}
                                <circle
                                    cx={x}
                                    cy={y + 1}
                                    r="2.4"
                                    fill="#fff6c2"
                                />
                            </g>
                        );
                    }
                    case 'coffee': {
                        const hx = 60 + handDx;
                        return (
                            <g key={item} {...root('wiggle')}>
                                <g data-pet-wear-idle="steam" style={box()}>
                                    {[-3, 2].map((dx) => (
                                        <path
                                            key={dx}
                                            d={`M${hx + dx} ${handY - 9} q-2 -3 0 -6 q2 -3 0 -6`}
                                            fill="none"
                                            stroke="#ffffff"
                                            strokeWidth="1.6"
                                            strokeLinecap="round"
                                            opacity="0.7"
                                        />
                                    ))}
                                </g>
                                <path
                                    d={`M${hx + 5} ${handY - 3} a4 4 0 0 1 0 7`}
                                    fill="none"
                                    stroke={LINE}
                                    strokeWidth="2"
                                />
                                <rect
                                    {...INK_THIN}
                                    x={hx - 6}
                                    y={handY - 6}
                                    width="11"
                                    height="12"
                                    rx="2"
                                    fill={c}
                                />
                            </g>
                        );
                    }
                    case 'headphones':
                        return (
                            <g key={item} {...root('jump')}>
                                <g data-pet-wear-idle="bob" style={box()}>
                                    <path
                                        d={`M${60 - r * 0.92} ${eyeY} A${r * 0.95} ${r * 1.05} 0 0 1 ${60 + r * 0.92} ${eyeY}`}
                                        fill="none"
                                        stroke={LINE}
                                        strokeWidth="5.5"
                                    />
                                    <path
                                        d={`M${60 - r * 0.92} ${eyeY} A${r * 0.95} ${r * 1.05} 0 0 1 ${60 + r * 0.92} ${eyeY}`}
                                        fill="none"
                                        stroke={c}
                                        strokeWidth="3"
                                    />
                                    {[-1, 1].map((side) => (
                                        <rect
                                            key={side}
                                            {...INK_THIN}
                                            x={60 + side * r * 0.98 - 4}
                                            y={eyeY - 6}
                                            width="8"
                                            height="12"
                                            rx="3"
                                            fill={c}
                                        />
                                    ))}
                                </g>
                            </g>
                        );
                    case 'kite': {
                        const hx = 60 + handDx;
                        const kx = Math.min(108, hx + 16);
                        const ky = Math.max(14, top - 4);
                        return (
                            <g key={item} {...root('jump')}>
                                <path
                                    d={`M${hx} ${handY} Q${hx + 14} ${(handY + ky) / 2} ${kx} ${ky + 9}`}
                                    fill="none"
                                    stroke={LINE}
                                    strokeWidth="1.2"
                                />
                                <g
                                    data-pet-wear-idle="sway"
                                    style={box('50% 100%')}
                                >
                                    <path
                                        {...INK_THIN}
                                        d={`M${kx} ${ky - 9} L${kx + 7} ${ky} L${kx} ${ky + 9} L${kx - 7} ${ky} Z`}
                                        fill={c}
                                    />
                                    <path
                                        d={`M${kx} ${ky - 9} V${ky + 9} M${kx - 7} ${ky} H${kx + 7}`}
                                        stroke={LINE}
                                        strokeWidth="1"
                                    />
                                </g>
                            </g>
                        );
                    }
                    case 'monocle': {
                        const x = 60 + eyeDx;
                        const lens = Math.max(5.5, eyeDx * 0.62);
                        return (
                            <g key={item} {...root('glint')}>
                                <circle
                                    cx={x}
                                    cy={eyeY}
                                    r={lens}
                                    fill="#ffffff"
                                    fillOpacity="0.18"
                                    stroke={LINE}
                                    strokeWidth="4.5"
                                />
                                <circle
                                    cx={x}
                                    cy={eyeY}
                                    r={lens}
                                    fill="none"
                                    stroke={c}
                                    strokeWidth="2.2"
                                />
                                <path
                                    d={`M${x + lens * 0.7} ${eyeY + lens * 0.7} q4 10 -2 18`}
                                    fill="none"
                                    stroke={c}
                                    strokeWidth="1.2"
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
