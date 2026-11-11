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

/** Mark + wordmark. `compact` (sign-in screens) shows only "Luna". */
export default function AppLogo({ compact = false }: { compact?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2 text-sm font-bold whitespace-nowrap">
            <AppLogoMark />
            <span>
                {!compact && <span className="mr-1">Orchid City</span>}
                <span className="text-accent">Luna</span>
            </span>
        </span>
    );
}
