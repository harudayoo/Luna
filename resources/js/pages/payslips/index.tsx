import { Head, Link } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { index as payslipsIndex, print as printRoute } from '@/routes/payslips';

type Props = {
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
const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);

/** My payslips: every payslip HR has made for you, newest first, each printable. */
export default function Payslips({ payslips }: Props) {
    return (
        <>
            <Head title="My payslips" />
            <p className="ocs-eyebrow">Pay</p>
            <h2 className="mb-6 text-2xl font-semibold">My payslips</h2>

            {payslips.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    No payslips yet. They show up here once HR makes them.
                </p>
            ) : (
                <ul className="grid gap-2">
                    {payslips.map((p) => (
                        <li
                            key={p.id}
                            className="flex min-h-14 items-center gap-3 bg-surface py-2 pr-2 pl-4"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {fmt(p.start, {
                                        month: 'short',
                                        day: 'numeric',
                                    })}{' '}
                                    –{' '}
                                    {fmt(p.end, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </p>
                                <p className="text-sm text-muted">
                                    Net {peso(p.net_pay)} · issued{' '}
                                    {fmt(p.issued_on, {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                    {p.released_on &&
                                        ` · received ${fmt(p.released_on, {
                                            month: 'short',
                                            day: 'numeric',
                                        })}`}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-10"
                                asChild
                            >
                                <Link href={printRoute(p.id)}>
                                    <Printer /> View
                                </Link>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

Payslips.layout = {
    breadcrumbs: [{ title: 'My payslips', href: payslipsIndex() }],
};
