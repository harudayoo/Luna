/*
 * The pet, drawn in code (spec 2026-11-24-luna-pet): a little moon creature in five stages,
 * Egg · Hatchling · Moonling · Bright · Full Moon. Colours are tokens, so one drawing works in
 * both themes. Parts the motion (lib/ocs.ts petIdle / petFed / petGrow) moves: [data-pet-body],
 * [data-pet-eye], [data-pet-glow]. Swapping in commissioned art only changes this file.
 */
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
 * still ahead on the panel's growth path. `className` replaces the card sizes.
 */
export function PetSprite({
    stage,
    title,
    locked = false,
    className = CARD_SIZE,
}: {
    stage: number;
    title: string;
    locked?: boolean;
    className?: string;
}) {
    const r = SIZE[stage] ?? 40;
    const cy = 96 - r - 4;

    return (
        <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={title}
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
                {stage === 0 ? <Egg /> : <Body stage={stage} r={r} cy={cy} />}
            </g>
            {!locked && stage === 4 && <Sparkles />}
        </svg>
    );
}

function Egg() {
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
        </>
    );
}

function Body({ stage, r, cy }: { stage: number; r: number; cy: number }) {
    const eyeY = cy - r * 0.1;
    const eyeDx = r * 0.36;

    return (
        <>
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
            {/* The crescent mark, from the Moonling on. */}
            {stage >= 2 && (
                <path
                    d={`M${60 - 5} ${cy - r * 0.62} a7 7 0 1 0 10 -1 a5.5 5.5 0 1 1 -10 1 z`}
                    fill={ACCENT}
                />
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
            <ellipse
                data-pet-eye
                style={EYE}
                cx={60 - eyeDx}
                cy={eyeY}
                rx="3.5"
                ry="4.5"
                fill={FACE}
            />
            <ellipse
                data-pet-eye
                style={EYE}
                cx={60 + eyeDx}
                cy={eyeY}
                rx="3.5"
                ry="4.5"
                fill={FACE}
            />
            <path
                d={`M${60 - 5} ${eyeY + 8} q5 5 10 0`}
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
