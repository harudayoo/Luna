/*
 * The pet, drawn in code (spec 2026-11-24-luna-pet): a little moon creature in five stages,
 * Egg · Hatchling · Moonling · Bright · Full Moon. Colours are tokens, so one drawing works in
 * both themes. Parts the motion (lib/ocs.ts petIdle / petFed / petGrow) moves: [data-pet-body],
 * [data-pet-eye], [data-pet-glow]. Swapping in commissioned art only changes this file.
 */
import type { MoodLevel, MoonlingKind } from '@/lib/pet';

const PRIMARY = 'var(--color-primary)';
const ACCENT = 'var(--color-accent)';
const FACE = 'var(--color-on-primary)';
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
    className = CARD_SIZE,
}: {
    stage: number;
    title: string;
    locked?: boolean;
    crown?: boolean;
    mood?: MoodLevel;
    /** Which kind of moonling (slice 6): its mark, and what it has around its body. */
    kind?: MoonlingKind;
    className?: string;
}) {
    const r = SIZE[stage] ?? 40;
    const cy = 96 - r - 4;
    // The top of the head (the egg's tip), where the crown sits.
    const top = stage === 0 ? 32 : cy - r;

    return (
        <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={title}
            data-pet-kind={kind}
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
                {stage === 0 ? (
                    <Egg kind={kind} />
                ) : (
                    <Body stage={stage} r={r} cy={cy} mood={mood} kind={kind} />
                )}
                {crown && !locked && <Crown base={top + 4} />}
            </g>
            {!locked && stage === 4 && <Sparkles />}
        </svg>
    );
}

function Egg({ kind }: { kind: MoonlingKind }) {
    return (
        <>
            <ellipse cx="60" cy="66" rx="26" ry="34" fill={PRIMARY} />
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
                    d={`M${60 - r * 0.6} ${cy - r * 0.7} q${r * 0.15} ${-r * 0.55} ${r * 0.3} ${-r * 0.2} q${r * 0.15} ${-r * 0.5} ${r * 0.3} ${-r * 0.2} q${r * 0.15} ${-r * 0.5} ${r * 0.3} ${-r * 0.15} q${r * 0.15} ${-r * 0.4} ${r * 0.3} ${r * 0.05} Z`}
                    fill={ACCENT}
                />
            );
        case 'nova':
            // A burst crown of rays.
            return (
                <path
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

    return (
        <>
            <KindBack kind={kind} r={r} cy={cy} />
            {/* Arms from the Moonling on, feet on everything that hatched. */}
            {stage >= 2 && (
                <>
                    <ellipse
                        cx={60 - r - 2}
                        cy={cy + r * 0.25}
                        rx="6"
                        ry="9"
                        fill={PRIMARY}
                        transform={`rotate(25 ${60 - r - 2} ${cy + r * 0.25})`}
                    />
                    <ellipse
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
                cx={60 - r * 0.4}
                cy={cy + r}
                rx="7"
                ry="4"
                fill={PRIMARY}
            />
            <ellipse
                cx={60 + r * 0.4}
                cy={cy + r}
                rx="7"
                ry="4"
                fill={PRIMARY}
            />
            <circle cx="60" cy={cy} r={r} fill={PRIMARY} />
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
                        <ellipse
                            key={x}
                            data-pet-eye
                            style={EYE}
                            cx={x}
                            cy={sleepy ? eyeY + 1.5 : eyeY}
                            rx={sleepy ? 4 : 3.5}
                            ry={sleepy ? 1.4 : 4.5}
                            fill={FACE}
                        />
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
