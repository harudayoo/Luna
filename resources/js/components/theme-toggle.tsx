import { ocsRef } from '@/lib/ocs';

const attach = ocsRef(['theme-toggle', 'squish']);

/** The kit's ThemeToggle (resources/ocs/guides/ThemeToggle.md). ocs.js owns the click. */
export function ThemeToggle() {
    return (
        <button
            type="button"
            ref={attach}
            className="ocs-btn ocs-icon-btn"
            aria-label="Toggle dark mode"
        >
            <svg
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
