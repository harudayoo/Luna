import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard } from '@/routes';
import { index as leaveIndex } from '@/routes/leave';

type Props = {
    pto: {
        balance_hours: number;
        hours_per_day: number;
        next_payday: string | null;
        next_accrual: number | null;
    };
};

const COMING = [
    {
        eyebrow: 'Calendar',
        title: 'Office calendar',
        text: 'Everyone’s leave and Philippine holidays.',
    },
    {
        eyebrow: 'Payroll',
        title: 'Cut-offs',
        text: 'Accruals and deductions per pay period.',
    },
];

const short = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

export default function Dashboard({ pto }: Props) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Dashboard" />
            <p className="ocs-eyebrow">Luna</p>
            <h2 className="mb-6 text-2xl font-semibold">
                Hello, {auth.user.name.split(' ')[0]}
            </h2>
            <div className="ocs-grid">
                <Link
                    href={leaveIndex()}
                    prefetch
                    className="ocs-card ocs-card-link block"
                >
                    <p className="ocs-eyebrow">Leave</p>
                    <h3>{pto.balance_hours.toFixed(2)} h of PTO</h3>
                    <p>
                        {(pto.balance_hours / pto.hours_per_day).toFixed(2)}{' '}
                        days
                        {pto.next_payday &&
                            pto.next_accrual !== null &&
                            ` · +${pto.next_accrual.toFixed(2)} h on ${short(pto.next_payday)}`}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-primary">
                        Log or view leave →
                    </p>
                </Link>
                {COMING.map((m) => (
                    <section key={m.eyebrow} className="ocs-card">
                        <p className="ocs-eyebrow">{m.eyebrow}</p>
                        <h3>{m.title}</h3>
                        <p>{m.text}</p>
                        <p className="mt-4">
                            <span className="ocs-badge">coming soon</span>
                        </p>
                    </section>
                ))}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
