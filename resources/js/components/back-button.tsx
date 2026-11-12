import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { backHop, ocs } from '@/lib/ocs';
import { cn } from '@/lib/utils';

/**
 * Luna's Back button: a kit secondary button (.ocs-btn-secondary, press = the kit's squish) with its own
 * hover, backHop (lib/ocs.ts): in light the arrow steps back with pencil motion lines and the letters
 * lean back; in dark it springs back trailing a glowing ghost and the letters hop right to left.
 * `label` names where it goes ("Payroll", "Back"); the letters are split here so the effect never
 * rewrites React's nodes. On a surface pass `className="bg-bg"`, as with other secondary buttons.
 */
export function BackButton({
    href,
    label = 'Back',
    className,
}: {
    href: ComponentProps<typeof Link>['href'];
    label?: string;
    className?: string;
}) {
    const ref = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) {
            return;
        }
        // The kit's press has no teardown: attach it once (strict mode runs effects twice).
        const node = el as HTMLAnchorElement & { __ocsSquish?: boolean };
        if (!node.__ocsSquish) {
            node.__ocsSquish = true;
            ocs().squish(el);
        }

        return backHop(el);
    }, []);

    return (
        <Link
            ref={ref}
            href={href}
            aria-label={label === 'Back' ? 'Back' : `Back to ${label}`}
            className={cn(
                'ocs-btn ocs-btn-secondary gap-2 px-3 [&_svg]:size-4',
                className,
            )}
        >
            <span className="relative inline-flex" aria-hidden="true">
                {/* Pencil motion lines (light), drawn in behind the arrow as it steps back. */}
                <span
                    data-back-line
                    className="absolute top-1.25 left-full ml-0.5 h-[1.5px] w-2 origin-left scale-x-0 bg-primary dark:hidden"
                />
                <span
                    data-back-line
                    className="absolute top-2.5 left-full ml-1.5 h-[1.5px] w-1.5 origin-left scale-x-0 bg-primary dark:hidden"
                />
                {/* Its glowing ghost (dark), left behind as it springs back. */}
                <span
                    data-back-ghost
                    className="absolute inset-0 hidden text-primary opacity-0 drop-shadow-[0_0_4px_var(--primary)] dark:inline-flex"
                >
                    <ArrowLeft />
                </span>
                <span data-back-arrow className="inline-flex">
                    <ArrowLeft />
                </span>
            </span>
            <span className="inline-flex" aria-hidden="true">
                {[...new Intl.Segmenter().segment(label)].map(
                    ({ segment: c }, i) => (
                        <span
                            key={i}
                            data-back-char
                            className="inline-block whitespace-pre"
                        >
                            {c}
                        </span>
                    ),
                )}
            </span>
        </Link>
    );
}
