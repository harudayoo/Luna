import { Head, usePage } from '@inertiajs/react';
import { dashboard } from '@/routes';

const MODULES = [
    {
        eyebrow: 'Leave',
        title: 'Time off',
        text: 'Log leave and see your PTO balance.',
    },
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

export default function Dashboard() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Dashboard" />
            <p className="ocs-eyebrow">Luna</p>
            <h2 className="mb-6 text-2xl font-semibold">
                Hello, {auth.user.name.split(' ')[0]}
            </h2>
            <div className="ocs-grid">
                {MODULES.map((m) => (
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
