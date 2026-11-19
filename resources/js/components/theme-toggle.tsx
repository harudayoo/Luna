import { useRef } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import { ocsRef } from '@/lib/ocs';
import { switchTheme } from '@/lib/theme-switch';

const attach = ocsRef(['squish']);

/**
 * The kit's ThemeToggle look (resources/ocs/guides/ThemeToggle.md), with Luna's own switch: always switches,
 * and plays a random effect from the tap (lib/theme-switch.ts).
 */
export function ThemeToggle() {
    const { resolvedAppearance } = useAppearance();
    const icon = useRef<SVGSVGElement>(null);

    return (
        <button
            type="button"
            ref={attach}
            className="ocs-btn ocs-icon-btn"
            aria-label="Toggle dark mode"
            aria-pressed={resolvedAppearance === 'dark'}
            onClick={(e) => {
                // A keyboard press has no pointer position: start from the button itself.
                const r = e.currentTarget.getBoundingClientRect();
                const fromKey = e.detail === 0;
                switchTheme(
                    {
                        x: fromKey ? r.left + r.width / 2 : e.clientX,
                        y: fromKey ? r.top + r.height / 2 : e.clientY,
                    },
                    icon.current,
                );
            }}
        >
            <svg
                ref={icon}
                className="ocs-theme-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
            >
                <g className="sun">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </g>
                <path
                    className="moon"
                    d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
                />
            </svg>
        </button>
    );
}
