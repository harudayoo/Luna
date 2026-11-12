import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { PeopleTabs } from '@/components/people-tabs';
import { Button } from '@/components/ui/button';
import { payroll as payrollRoute } from '@/routes/people';
import { edit as editRoute } from '@/routes/people/payroll';
import { print as printRoute } from '@/routes/payslips';

type Row = {
    id: number;
    name: string;
    position: string | null;
    has_salary: boolean;
    payslip_id: number | null;
    net_pay: number | null;
};

type Props = {
    cutoff: {
        start: string;
        end: string;
        prev: string;
        next: string;
        is_current: boolean;
    };
    rows: Row[];
    total_net: number;
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

/** Payroll (HR): everyone's payslip for one cut-off, to prepare and print. */
export default function Payroll({ cutoff, rows, total_net }: Props) {
    const made = rows.filter((r) => r.payslip_id !== null).length;

    return (
        <>
            <Head title="Payroll" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Payroll</h2>
            <PeopleTabs />

            {/* Cut-off switcher, as on Leave & pay. */}
            <div className="mb-6 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={payrollRoute({ query: { cutoff: cutoff.prev } })}
                        preserveScroll
                        aria-label="Previous cut-off"
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="ocs-eyebrow mb-0">
                        {cutoff.is_current ? 'This cut-off' : 'Cut-off'}
                    </p>
                    <p className="font-semibold">
                        {short(cutoff.start)} –{' '}
                        {fmt(cutoff.end, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={payrollRoute({ query: { cutoff: cutoff.next } })}
                        preserveScroll
                        aria-label="Next cut-off"
                    >
                        <ChevronRight />
                    </Link>
                </Button>
            </div>

            <div className="ocs-grid mb-6">
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Payslips made</p>
                    <p className="text-3xl font-semibold text-ink">
                        {made}{' '}
                        <span className="text-base text-muted">
                            of {rows.length} people
                        </span>
                    </p>
                </section>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Net pay this cut-off</p>
                    <p className="text-3xl font-semibold text-ink">
                        {peso(total_net)}
                    </p>
                    <p className="mt-1">Across the payslips made so far</p>
                </section>
            </div>

            <ul className="grid gap-2">
                {rows.map((r) => (
                    <li
                        key={r.id}
                        className="flex flex-col gap-3 bg-surface p-4 sm:flex-row sm:items-center"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{r.name}</p>
                            <p className="text-sm text-muted">
                                {r.position ?? 'No position set'}
                                {' · '}
                                {r.net_pay !== null
                                    ? `Net ${peso(r.net_pay)}`
                                    : r.has_salary
                                      ? 'No payslip yet'
                                      : 'No monthly salary set'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={r.payslip_id ? 'secondary' : 'default'}
                                size="sm"
                                className={`min-h-10 flex-1 sm:flex-none ${r.payslip_id ? 'bg-bg' : ''}`}
                                asChild
                            >
                                <Link href={editRoute([r.id, cutoff.start])}>
                                    {r.payslip_id ? 'Edit' : 'Prepare payslip'}
                                </Link>
                            </Button>
                            {r.payslip_id && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-10"
                                    asChild
                                >
                                    <Link
                                        href={printRoute(r.payslip_id)}
                                        aria-label={`Print ${r.name}'s payslip`}
                                    >
                                        <Printer /> Print
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

Payroll.layout = {
    breadcrumbs: [{ title: 'Payroll', href: payrollRoute() }],
};
