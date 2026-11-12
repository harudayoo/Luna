import { Head, Link, router } from '@inertiajs/react';
import { CheckCheck, Printer } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { MarkReceivedDialog } from '@/components/mark-received-dialog';
import { Button } from '@/components/ui/button';
import { payroll as payrollRoute } from '@/routes/people';
import {
    edit as editRoute,
    release as releaseRoute,
} from '@/routes/people/payroll';
import { print as printRoute } from '@/routes/payslips';

type Props = {
    person: {
        id: number;
        name: string;
        position: string | null;
        has_salary: boolean;
    };
    payslips: {
        id: number;
        start: string;
        end: string;
        issued_on: string;
        net_pay: number;
        released_on: string | null;
    }[];
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const short = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);

/**
 * One person's payslips (HR), past ones included: open, re-print, mark received or undo a release
 * (to correct a payslip, then release it again).
 */
export default function PersonPayslips({ person, payslips }: Props) {
    const release = (id: number, released: boolean) =>
        router.patch(
            releaseRoute(id).url,
            { released },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={`Payslips · ${person.name}`} />
            <BackButton
                href={payrollRoute()}
                label="Payroll"
                className="mb-4"
            />
            <p className="ocs-eyebrow">Payslips</p>
            <h2 className="mb-1 text-2xl font-semibold">{person.name}</h2>
            <p className="mb-6 text-sm text-muted">
                {person.position ?? 'No position set'} ·{' '}
                {payslips.length === 1
                    ? '1 payslip'
                    : `${payslips.length} payslips`}
            </p>

            {payslips.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    No payslips yet.{' '}
                    {person.has_salary
                        ? 'Prepare one from Payroll.'
                        : 'Set a monthly salary first (People → Leave details).'}
                </p>
            ) : (
                <ul className="grid gap-2">
                    {payslips.map((p) => (
                        <li
                            key={p.id}
                            className="flex flex-col gap-3 bg-surface p-4 sm:flex-row sm:items-center"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {short(p.start)} –{' '}
                                    {fmt(p.end, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </p>
                                <p className="text-sm text-muted">
                                    Net {peso(p.net_pay)} · issued{' '}
                                    {short(p.issued_on)}
                                </p>
                                <p
                                    className={`text-sm font-semibold ${p.released_on ? 'text-success' : 'text-muted'}`}
                                >
                                    {p.released_on
                                        ? `Received ${short(p.released_on)}`
                                        : 'Not released yet'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="min-h-10 flex-1 bg-bg sm:flex-none"
                                    asChild
                                >
                                    <Link
                                        href={editRoute([person.id, p.start])}
                                    >
                                        {p.released_on ? 'View' : 'Edit'}
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-10"
                                    asChild
                                >
                                    <Link
                                        href={printRoute(p.id)}
                                        aria-label={`Print the ${short(p.start)} payslip`}
                                    >
                                        <Printer /> Print
                                    </Link>
                                </Button>
                                {p.released_on ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="min-h-10"
                                        onClick={() => release(p.id, false)}
                                        aria-label={`Undo the ${short(p.start)} release`}
                                    >
                                        Undo
                                    </Button>
                                ) : (
                                    <MarkReceivedDialog
                                        url={releaseRoute(p.id)}
                                        data={{ released: true }}
                                        title={`Pay received · ${short(p.start)} – ${short(p.end)}`}
                                        description={`The day ${person.name} got this pay. The payslip is locked once it's marked.`}
                                        payday={p.end}
                                        trigger={
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="min-h-10 bg-bg"
                                                aria-label={`Mark the ${short(p.start)} pay received`}
                                            >
                                                <CheckCheck /> Received
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

PersonPayslips.layout = {
    breadcrumbs: [{ title: 'Payroll', href: payrollRoute() }],
};
