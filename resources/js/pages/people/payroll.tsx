import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    FileSignature,
    History,
    Printer,
} from 'lucide-react';
import { PeopleTabs } from '@/components/people-tabs';
import { Button } from '@/components/ui/button';
import {
    payroll as payrollRoute,
    payslips as payslipsRoute,
} from '@/routes/people';
import {
    edit as editRoute,
    release as releaseRoute,
} from '@/routes/people/payroll';
import {
    all as releaseAllRoute,
    print as releasePrintRoute,
} from '@/routes/people/payroll/release';
import { print as printRoute } from '@/routes/payslips';

type Row = {
    id: number;
    name: string;
    position: string | null;
    has_salary: boolean;
    payslip_id: number | null;
    net_pay: number | null;
    /** The day HR recorded the pay as received; null until then. */
    released_on: string | null;
};

type Props = {
    cutoff: {
        start: string;
        end: string;
        prev: string;
        next: string;
        is_current: boolean;
    };
    /** Pay release: one payslip a month, or one per cut-off (People → Formulas). */
    frequency: 'monthly' | 'semi_monthly';
    rows: Row[];
    released: number;
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

/** Payroll (HR): everyone's payslip for one pay period (a month or a cut-off), to prepare and print. */
export default function Payroll({
    cutoff,
    frequency,
    rows,
    released,
    total_net,
}: Props) {
    const unit = frequency === 'monthly' ? 'month' : 'cut-off';
    const made = rows.filter((r) => r.payslip_id !== null).length;
    const release = (payslipId: number, isReleased: boolean) =>
        router.patch(
            releaseRoute(payslipId).url,
            { released: isReleased },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title="Payroll" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Payroll</h2>
            <PeopleTabs />

            {/* Pay period switcher, as on Leave & pay. */}
            <div className="mb-6 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link
                        href={payrollRoute({ query: { cutoff: cutoff.prev } })}
                        preserveScroll
                        aria-label={`Previous ${unit}`}
                    >
                        <ChevronLeft />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="ocs-eyebrow mb-0">
                        {cutoff.is_current
                            ? `This ${unit}`
                            : unit === 'month'
                              ? 'Month'
                              : 'Cut-off'}
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
                        aria-label={`Next ${unit}`}
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
                    <p className="ocs-eyebrow">Net pay this {unit}</p>
                    <p className="text-3xl font-semibold text-ink">
                        {peso(total_net)}
                    </p>
                    <p className="mt-1">Across the payslips made so far</p>
                </section>
                <section className="ocs-card">
                    <p className="ocs-eyebrow">Pay release</p>
                    <p className="text-3xl font-semibold text-ink">
                        {released}{' '}
                        <span className="text-base text-muted">
                            of {made} received
                        </span>
                    </p>
                    <p className="mt-1">
                        Mark each person once they have their pay, and have them
                        sign the release form.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {made > released && (
                            <Button
                                size="sm"
                                className="min-h-10"
                                onClick={() =>
                                    router.post(
                                        releaseAllRoute().url,
                                        { cutoff: cutoff.start },
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <CheckCheck /> Mark all received
                            </Button>
                        )}
                        {made > 0 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="min-h-10 bg-bg"
                                asChild
                            >
                                <Link
                                    href={releasePrintRoute({
                                        query: { cutoff: cutoff.start },
                                    })}
                                >
                                    <FileSignature /> Release form
                                </Link>
                            </Button>
                        )}
                    </div>
                </section>
            </div>

            <ul className="grid gap-2">
                {rows.map((r) => (
                    <li
                        key={r.id}
                        className="flex flex-col gap-3 bg-surface p-4 sm:flex-row sm:items-center"
                    >
                        <div className="min-w-0 flex-1">
                            {/* The name opens their payslip history (past cut-offs too). */}
                            <Link
                                href={payslipsRoute(r.id)}
                                className="block truncate font-semibold hover:text-primary"
                            >
                                {r.name}
                            </Link>
                            <p className="text-sm text-muted">
                                {r.position ?? 'No position set'}
                                {' · '}
                                {r.net_pay !== null
                                    ? `Net ${peso(r.net_pay)}`
                                    : r.has_salary
                                      ? 'No payslip yet'
                                      : 'No monthly salary set'}
                            </p>
                            {r.payslip_id !== null && (
                                <p
                                    className={`text-sm font-semibold ${r.released_on ? 'text-success' : 'text-muted'}`}
                                >
                                    {r.released_on
                                        ? `Received ${short(r.released_on)}`
                                        : 'Not released yet'}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={r.payslip_id ? 'secondary' : 'default'}
                                size="sm"
                                className={`min-h-10 flex-1 sm:flex-none ${r.payslip_id ? 'bg-bg' : ''}`}
                                asChild
                            >
                                <Link href={editRoute([r.id, cutoff.start])}>
                                    {r.released_on
                                        ? 'View'
                                        : r.payslip_id
                                          ? 'Edit'
                                          : 'Prepare payslip'}
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
                            {r.payslip_id !== null &&
                                (r.released_on ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="min-h-10"
                                        onClick={() =>
                                            release(
                                                r.payslip_id as number,
                                                false,
                                            )
                                        }
                                        aria-label={`Undo ${r.name}'s release`}
                                    >
                                        Undo
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="min-h-10 bg-bg"
                                        onClick={() =>
                                            release(
                                                r.payslip_id as number,
                                                true,
                                            )
                                        }
                                        aria-label={`Mark ${r.name}'s pay received`}
                                    >
                                        <CheckCheck /> Received
                                    </Button>
                                ))}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-10"
                                asChild
                            >
                                <Link
                                    href={payslipsRoute(r.id)}
                                    aria-label={`All of ${r.name}'s payslips`}
                                >
                                    <History /> History
                                </Link>
                            </Button>
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
