/**
 * The OCS mark (same artwork as public/favicon.svg), inline so it stays sharp at any size.
 * The brand purple and white are the logo's own colours, not UI tokens.
 */
export function AppLogoMark({ className = 'size-8' }: { className?: string }) {
    return (
        <svg
            viewBox="10 10 80 80"
            className={`shrink-0 ${className}`}
            role="img"
            aria-label="Orchid City Software"
        >
            <rect x="10" y="10" width="80" height="80" rx="14" fill="#6A1B7A" />
            <text
                x="50"
                y="61.5"
                textAnchor="middle"
                fontFamily="'Helvetica Neue', Arial, sans-serif"
                fontWeight="700"
                fontSize="32"
                fill="#FFFFFF"
            >
                OCS
            </text>
        </svg>
    );
}

/** The mark and the system's name, as on the sign-in screens. */
export default function AppLogo() {
    return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <AppLogoMark />
            <span className="text-lg leading-none font-bold tracking-tight text-accent">
                Luna
            </span>
        </span>
    );
}
