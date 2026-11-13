import { Link } from '@inertiajs/react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import {
    formulas as peopleFormulas,
    holidays as peopleHolidays,
    index as peopleIndex,
    payroll as peoplePayroll,
    leave as peopleLeave,
    policy as peoplePolicy,
    time as peopleTime,
} from '@/routes/people';

const TABS = [
    { title: 'People', href: peopleIndex(), path: '/people' },
    { title: 'Leave & pay', href: peopleLeave(), path: '/people/leave' },
    { title: 'Time', href: peopleTime(), path: '/people/time' },
    { title: 'Payroll', href: peoplePayroll(), path: '/people/payroll' },
    { title: 'Formulas', href: peopleFormulas(), path: '/people/formulas' },
    { title: 'Policy', href: peoplePolicy(), path: '/people/policy' },
    { title: 'Holidays', href: peopleHolidays(), path: '/people/holidays' },
];

/**
 * The People module's pages. Solid segments, no underline bar: the current one is
 * filled `primary`, like the kit's active items. Scrolls sideways if a phone is very narrow.
 */
export function PeopleTabs() {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <nav
            aria-label="People sections"
            className="-mx-4 mb-6 overflow-x-auto px-4"
        >
            <div className="inline-flex gap-1 bg-surface p-1">
                {TABS.map((t) => (
                    <Link
                        key={t.path}
                        href={t.href}
                        prefetch
                        aria-current={isCurrentUrl(t.path) ? 'page' : undefined}
                        className="flex min-h-10 items-center px-3 text-sm font-semibold whitespace-nowrap text-muted hover:bg-surface-hover hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary sm:px-4"
                    >
                        {t.title}
                    </Link>
                ))}
            </div>
        </nav>
    );
}
