/** OCS mark (public/favicon.svg) + wordmark: "Orchid City" and the app name in accent. */
export default function AppLogo({ compact = false }: { compact?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2 text-sm font-bold whitespace-nowrap">
            <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
            <span>
                {!compact && <span className="mr-1">Orchid City</span>}
                <span className="text-accent">Luna</span>
            </span>
        </span>
    );
}
