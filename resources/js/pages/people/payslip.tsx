import { Form, Head, Link, router } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { useState } from 'react';
import PayrollController from '@/actions/App/Http/Controllers/PayrollController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { index as peopleIndex, payroll as payrollRoute } from '@/routes/people';
import { release as releaseRoute } from '@/routes/people/payroll';
import { print as printRoute } from '@/routes/payslips';

type Inputs = {
    holiday_regular_days: number;
    holiday_special_days: number;
    absences: number;
    overtime_allowance: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    withholding_tax: number;
    cash_advance: number;
};

type Props = {
    person: {
        id: number;
        name: string;
        position: string | null;
        monthly_salary: number | null;
        daily_rate: number;
    };
    period: { start: string; end: string };
    payslip: Inputs & {
        basic_pay: number;
        unpaid_hours: number;
        issued_on: string;
    };
    saved: boolean;
    payslip_id: number | null;
    /** Set once HR marks the pay received; the payslip is locked until that's undone. */
    released_on: string | null;
    premiums: { regular: number; special: number };
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
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Prepare one payslip. Luna fills what it knows (half the monthly salary, the PTO ledger's unpaid
 * time, last payslip's deductions); HR types the rest. Totals update as you type; the server
 * recomputes them on save.
 */
export default function PayslipEditor({
    person,
    period,
    payslip,
    saved,
    payslip_id,
    released_on,
    premiums,
}: Props) {
    const [v, setV] = useState<Inputs>({
        holiday_regular_days: payslip.holiday_regular_days,
        holiday_special_days: payslip.holiday_special_days,
        absences: payslip.absences,
        overtime_allowance: payslip.overtime_allowance,
        sss: payslip.sss,
        philhealth: payslip.philhealth,
        pagibig: payslip.pagibig,
        withholding_tax: payslip.withholding_tax,
        cash_advance: payslip.cash_advance,
    });
    const set = (k: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setV({ ...v, [k]: Number(e.target.value) || 0 });

    const holidayPay = r2(
        person.daily_rate *
            (v.holiday_regular_days * premiums.regular +
                v.holiday_special_days * premiums.special),
    );
    const gross = r2(
        payslip.basic_pay + holidayPay + v.overtime_allowance - v.absences,
    );
    const deductions = r2(
        v.sss + v.philhealth + v.pagibig + v.withholding_tax + v.cash_advance,
    );
    const net = r2(gross - deductions);
    const range = `${fmt(period.start, { month: 'short', day: 'numeric' })} – ${fmt(period.end, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return (
        <>
            <Head title={`Payslip · ${person.name}`} />
            <BackButton
                href={payrollRoute({ query: { cutoff: period.start } })}
                label="Payroll"
                className="mb-4"
            />
            <p className="ocs-eyebrow">Payslip · {range}</p>
            <h2 className="mb-1 text-2xl font-semibold">{person.name}</h2>
            <p className="mb-6 text-sm text-muted">
                {person.position ?? 'No position set'}
                {person.monthly_salary !== null &&
                    ` · ${peso(person.monthly_salary)} a month (${peso(person.daily_rate)} a day)`}
            </p>

            {person.monthly_salary === null && (
                <p className="ocs-card mb-6 text-sm">
                    Set {person.name}&rsquo;s monthly salary first, under{' '}
                    <Link
                        href={peopleIndex()}
                        className="font-semibold text-primary"
                    >
                        People → Leave details
                    </Link>
                    .
                </p>
            )}

            {released_on && payslip_id && (
                <div className="ocs-card mb-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
                    <p className="flex-1">
                        <span className="font-semibold text-success">
                            Received{' '}
                            {new Intl.DateTimeFormat('en-PH', {
                                timeZone: 'UTC',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            }).format(new Date(`${released_on}T00:00:00Z`))}
                            .
                        </span>{' '}
                        This payslip is locked so it matches the release form.
                        Undo the release to change it.
                    </p>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-10 bg-bg"
                        onClick={() =>
                            router.patch(
                                releaseRoute(payslip_id).url,
                                { released: false },
                                { preserveScroll: true },
                            )
                        }
                    >
                        Undo release
                    </Button>
                </div>
            )}

            <Form
                {...PayrollController.update.form([person.id, period.start])}
                options={{ preserveScroll: true }}
                className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <section className="ocs-card grid gap-4">
                                <p className="ocs-eyebrow">Earnings</p>
                                <p className="flex justify-between gap-3 text-sm">
                                    <span>
                                        Basic pay{' '}
                                        <span className="text-muted">
                                            (½ of the monthly salary)
                                        </span>
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {peso(payslip.basic_pay)}
                                    </span>
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Amount
                                        name="holiday_regular_days"
                                        label="Regular holidays worked"
                                        hint={`+${premiums.regular * 100}% of the daily rate each`}
                                        days
                                        value={v.holiday_regular_days}
                                        onChange={set('holiday_regular_days')}
                                        error={errors.holiday_regular_days}
                                    />
                                    <Amount
                                        name="holiday_special_days"
                                        label="Special days worked"
                                        hint={`+${premiums.special * 100}% of the daily rate each`}
                                        days
                                        value={v.holiday_special_days}
                                        onChange={set('holiday_special_days')}
                                        error={errors.holiday_special_days}
                                    />
                                </div>
                                <p className="flex justify-between gap-3 text-sm">
                                    <span>Holiday pay</span>
                                    <span className="font-semibold tabular-nums">
                                        {peso(holidayPay)}
                                    </span>
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Amount
                                        name="absences"
                                        label="Absences / Unpaid time-off (₱)"
                                        hint={
                                            payslip.unpaid_hours > 0
                                                ? `${payslip.unpaid_hours.toFixed(2)} h unpaid PTO in this cut-off. Add lates here too.`
                                                : 'No unpaid PTO in this cut-off. Add lates here.'
                                        }
                                        value={v.absences}
                                        onChange={set('absences')}
                                        error={errors.absences}
                                    />
                                    <Amount
                                        name="overtime_allowance"
                                        label="Overtime / Allowance (₱)"
                                        value={v.overtime_allowance}
                                        onChange={set('overtime_allowance')}
                                        error={errors.overtime_allowance}
                                    />
                                </div>
                            </section>

                            <section className="ocs-card grid gap-4">
                                <p className="ocs-eyebrow">Deductions</p>
                                <p className="-mt-2 text-sm text-muted">
                                    From the accountant. Filled in from the last
                                    payslip, so only changes need typing.
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Amount
                                        name="sss"
                                        label="SSS (₱)"
                                        value={v.sss}
                                        onChange={set('sss')}
                                        error={errors.sss}
                                    />
                                    <Amount
                                        name="philhealth"
                                        label="PhilHealth (₱)"
                                        value={v.philhealth}
                                        onChange={set('philhealth')}
                                        error={errors.philhealth}
                                    />
                                    <Amount
                                        name="pagibig"
                                        label="Pag-IBIG (₱)"
                                        value={v.pagibig}
                                        onChange={set('pagibig')}
                                        error={errors.pagibig}
                                    />
                                    <Amount
                                        name="withholding_tax"
                                        label="Withholding tax (₱)"
                                        value={v.withholding_tax}
                                        onChange={set('withholding_tax')}
                                        error={errors.withholding_tax}
                                    />
                                    <Amount
                                        name="cash_advance"
                                        label="Cash advance / Company loan (₱)"
                                        value={v.cash_advance}
                                        onChange={set('cash_advance')}
                                        error={errors.cash_advance}
                                    />
                                </div>
                            </section>
                        </div>

                        {/* Totals stay in view beside the form on wide screens. */}
                        <aside className="ocs-card grid gap-3 lg:sticky lg:top-20">
                            <Total label="Gross pay" value={peso(gross)} />
                            <Total
                                label="Total deductions"
                                value={peso(deductions)}
                            />
                            <div>
                                <p className="ocs-eyebrow">Net pay</p>
                                <p className="text-3xl font-semibold text-ink">
                                    {peso(net)}
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="issued_on">Issue date</Label>
                                <Input
                                    id="issued_on"
                                    name="issued_on"
                                    type="date"
                                    defaultValue={payslip.issued_on}
                                    required
                                />
                                <InputError message={errors.issued_on} />
                            </div>
                            <InputError
                                message={
                                    errors.monthly_salary ??
                                    errors.cutoff ??
                                    errors.released
                                }
                            />
                            <Button
                                type="submit"
                                disabled={
                                    processing ||
                                    person.monthly_salary === null ||
                                    released_on !== null
                                }
                            >
                                {processing && <Spinner />}
                                {saved ? 'Save changes' : 'Save payslip'}
                            </Button>
                            {payslip_id && (
                                <Button
                                    variant="secondary"
                                    className="bg-bg"
                                    asChild
                                >
                                    <Link href={printRoute(payslip_id)}>
                                        <Printer /> Print payslip
                                    </Link>
                                </Button>
                            )}
                            <p className="text-xs text-muted">
                                {saved
                                    ? 'Saved. It prints on its own, or with the release form.'
                                    : 'Only HR and admin can see payslips.'}
                            </p>
                        </aside>
                    </>
                )}
            </Form>
        </>
    );
}

function Amount({
    name,
    label,
    hint,
    days = false,
    value,
    onChange,
    error,
}: {
    name: string;
    label: string;
    hint?: string;
    days?: boolean;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
}) {
    return (
        <div className="grid content-start gap-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
                id={name}
                name={name}
                type="number"
                inputMode="decimal"
                min="0"
                step={days ? '0.5' : '0.01'}
                value={value}
                onChange={onChange}
                required
            />
            {hint && <p className="text-xs text-muted">{hint}</p>}
            <InputError message={error} />
        </div>
    );
}

function Total({ label, value }: { label: string; value: string }) {
    return (
        <p className="flex justify-between gap-3 text-sm">
            <span className="text-muted">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </p>
    );
}

PayslipEditor.layout = {
    breadcrumbs: [{ title: 'Payroll', href: payrollRoute() }],
};
