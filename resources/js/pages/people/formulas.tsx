import { Form, Head } from "@inertiajs/react";
import { useState } from "react";
import type { ReactNode } from "react";
import FormulasController from "@/actions/App/Http/Controllers/FormulasController";
import InputError from "@/components/input-error";
import { PeopleTabs } from "@/components/people-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formulas as formulasRoute } from "@/routes/people";

type Frequency = "monthly" | "semi_monthly";

type Props = {
    policy: {
        accrual_mode: string;
        accrual_label: string;
        accrual_hours: number;
        hours_per_day: number;
    };
    work_days: { month: string; days: number };
    premiums: { regular: number; special: number };
    frequency: Frequency;
    default_frequency: Frequency;
    schedule: { from: string; frequency: Frequency; upcoming: boolean }[];
    frequencies: { value: Frequency; label: string }[];
    next_month: string;
};

const ACCRUAL_RULE: Record<string, string> = {
    full: "Earned in full every cut-off, even with leave in it.",
    unpaid: "Hours covered by PTO still earn; unpaid hours earn nothing, so the cut-off’s credit is prorated.",
    all: "Any leave hour earns nothing: the credit is prorated by hours actually worked in the cut-off.",
    forfeit:
        "Any leave in a cut-off, even part of a day, loses that cut-off’s whole credit. Leave on a holiday doesn’t count.",
};

const peso = (n: number) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    }).format(n);
const hrs = (n: number) => `${n.toFixed(2)} h`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const monthName = (ym: string) =>
    new Intl.DateTimeFormat("en-PH", {
        timeZone: "UTC",
        month: "long",
        year: "numeric",
    }).format(new Date(`${ym.slice(0, 7)}-01T00:00:00Z`));

/** HR and admin: how Luna works out PTO and pay, and how often pay is released. */
export default function Formulas({
    policy,
    work_days,
    premiums,
    frequency,
    default_frequency,
    schedule,
    frequencies,
    next_month,
}: Props) {
    const label = (f: Frequency) =>
        frequencies.find((x) => x.value === f)?.label ?? f;
    const monthly = frequency === "monthly";
    const hpd = policy.hours_per_day;
    const perMonth = policy.accrual_hours * 2;

    return (
        <>
            <Head title="Formulas" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">Formulas</h2>
            <PeopleTabs />

            <div className="grid max-w-3xl gap-6">
                <PayRelease
                    frequency={frequency}
                    default_frequency={default_frequency}
                    schedule={schedule}
                    frequencies={frequencies}
                    next_month={next_month}
                    label={label}
                />

                <section className="ocs-card grid gap-4">
                    <div>
                        <p className="ocs-eyebrow">PTO · per cut-off</p>
                        <h3 className="text-lg font-semibold">
                            How PTO is earned and used
                        </h3>
                        <p className="text-sm text-muted">
                            PTO always runs per cut-off (1st–15th and 16th–month
                            end), whichever way pay is released.
                        </p>
                    </div>
                    <dl className="grid gap-4">
                        <Formula
                            name="Credit per cut-off"
                            formula={`${round2(policy.accrual_hours).toFixed(2)} h`}
                        >
                            Kept unrounded ({policy.accrual_hours.toFixed(4)}
                            …), so balances read{" "}
                            {[1, 2, 3]
                                .map((n) =>
                                    round2(policy.accrual_hours * n).toFixed(2),
                                )
                                .join(", ")}
                            . That is {hrs(perMonth)} a month and{" "}
                            {hrs(policy.accrual_hours * 24)} a year, from the
                            cut-off someone joins in.
                        </Formula>
                        <Formula
                            name="Leave in the cut-off"
                            formula={policy.accrual_label}
                        >
                            {ACCRUAL_RULE[policy.accrual_mode]}
                        </Formula>
                        <Formula
                            name="Hours taken"
                            formula={`days of leave × ${hpd} h`}
                        >
                            Mornings are 3 h, afternoons 5 h. Leave on a public
                            holiday isn’t charged.
                        </Formula>
                        <Formula
                            name="Balance"
                            formula="carried over + credit − hours taken"
                        >
                            Unused hours carry over to the next cut-off and the
                            next year.
                        </Formula>
                        <Formula name="Unpaid hours" formula="hours below zero">
                            When the balance goes below zero, the shortfall is
                            unpaid and the next cut-off starts from 0. It is
                            deducted on the payslip that covers that cut-off
                            {monthly
                                ? " (the month’s payslip adds up both cut-offs)"
                                : ""}
                            .
                        </Formula>
                    </dl>
                </section>

                <section className="ocs-card grid gap-4">
                    <div>
                        <p className="ocs-eyebrow">
                            Pay · {monthly ? "per month" : "per cut-off"}
                        </p>
                        <h3 className="text-lg font-semibold">
                            How a payslip is worked out
                        </h3>
                    </div>
                    <dl className="grid gap-4">
                        <Formula
                            name="Daily rate"
                            formula="monthly ÷ the month’s working days"
                        >
                            Working days are every Monday to Friday; holidays
                            count, as they&rsquo;re paid. The rate moves with
                            the month ({work_days.month}: {work_days.days}{" "}
                            days). A fixed daily rate set for a person on People
                            wins.
                        </Formula>
                        <Formula
                            name="Hourly rate"
                            formula={`daily rate ÷ ${hpd}`}
                        >
                            Kept unrounded, so a peso figure is rounded only
                            once, at the end.
                        </Formula>
                        <Formula
                            name="Basic pay"
                            formula={monthly ? "monthly salary" : "monthly ÷ 2"}
                        >
                            {monthly
                                ? "The whole salary, once a month."
                                : "Half the salary on the 15th and half at month end."}
                        </Formula>
                        <Formula
                            name="Holiday pay"
                            formula={`daily rate × (regular days × ${premiums.regular * 100}% + special days × ${premiums.special * 100}%)`}
                        >
                            The premium for working a holiday, on top of the day
                            already in the salary.
                        </Formula>
                        <Formula
                            name="Absences"
                            formula="unpaid PTO hours × hourly rate"
                        >
                            Unpaid PTO only.
                        </Formula>
                        <Formula
                            name="Tardiness"
                            formula="declared late minutes ÷ 60 × hourly rate"
                        >
                            Only what people log under Time (as posted on
                            WIP&rsquo;s Attendance channel), office hours only.
                            The time-in and time-out stamps are a record and
                            aren&rsquo;t charged.
                        </Formula>
                        <Formula
                            name="Gross pay"
                            formula="basic + holiday pay + overtime/allowance − absences − tardiness"
                        />
                        <Formula
                            name="Deductions"
                            formula="SSS + PhilHealth + Pag-IBIG + withholding tax + cash advance/loan"
                        >
                            Entered by HR from the accountant’s figures.
                        </Formula>
                        <Formula name="Net pay" formula="gross − deductions" />
                    </dl>
                </section>

                <Example monthly={monthly} days={work_days.days} hpd={hpd} />
            </div>
        </>
    );
}

function Formula({
    name,
    formula,
    children,
}: {
    name: string;
    formula: string;
    children?: ReactNode;
}) {
    return (
        <div className="grid gap-1 bg-background p-3 sm:grid-cols-[10rem_1fr] sm:gap-x-4">
            <dt className="text-sm font-semibold">{name}</dt>
            <dd className="grid gap-1">
                <span className="font-mono text-sm wrap-break-word text-primary">
                    {formula}
                </span>
                {children && (
                    <span className="text-xs text-muted">{children}</span>
                )}
            </dd>
        </div>
    );
}

function PayRelease({
    frequency,
    default_frequency,
    schedule,
    frequencies,
    next_month,
    label,
}: Pick<
    Props,
    | "frequency"
    | "default_frequency"
    | "schedule"
    | "frequencies"
    | "next_month"
> & { label: (f: Frequency) => string }) {
    const [choice, setChoice] = useState<Frequency>(
        frequency === "monthly" ? "semi_monthly" : "monthly",
    );

    return (
        <section className="ocs-card grid gap-4">
            <div>
                <p className="ocs-eyebrow">Pay release</p>
                <p className="text-2xl font-semibold">{label(frequency)}</p>
                <p className="text-sm text-muted">
                    {frequency === "monthly"
                        ? "One payslip a month, released at month end."
                        : "One payslip per cut-off, released on the 15th and at month end."}
                </p>
            </div>

            <ul className="grid gap-1 text-sm">
                <li className="text-muted">
                    {label(default_frequency)} since the office started
                </li>
                {schedule.map((s) => (
                    <li
                        key={s.from}
                        className={s.upcoming ? "font-semibold" : "text-muted"}
                    >
                        {label(s.frequency)} from {monthName(s.from)}
                        {s.upcoming ? " (upcoming)" : ""}
                    </li>
                ))}
            </ul>

            <Form {...FormulasController.update.form()} className="grid gap-4">
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid content-start gap-2">
                                <Label htmlFor="frequency">Change to</Label>
                                <Select
                                    name="frequency"
                                    value={choice}
                                    onValueChange={(v) =>
                                        setChoice(v as Frequency)
                                    }
                                >
                                    <SelectTrigger
                                        id="frequency"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {frequencies.map((f) => (
                                            <SelectItem
                                                key={f.value}
                                                value={f.value}
                                            >
                                                {f.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.frequency} />
                            </div>
                            <div className="grid content-start gap-2">
                                <Label htmlFor="from">Starting</Label>
                                <Input
                                    id="from"
                                    name="from"
                                    type="month"
                                    defaultValue={next_month}
                                    required
                                />
                                <InputError message={errors.from} />
                            </div>
                        </div>
                        <p className="text-xs text-muted">
                            Starts on the 1st of that month. Payslips already
                            made keep their period, and PTO stays per cut-off.
                        </p>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="justify-self-start"
                        >
                            {processing && <Spinner />}
                            Save pay release
                        </Button>
                    </>
                )}
            </Form>
        </section>
    );
}

/** A worked example with numbers HR types in. Display only: payslips are computed on the server. */
function Example({
    monthly,
    days,
    hpd,
}: {
    monthly: boolean;
    days: number;
    hpd: number;
}) {
    const [salary, setSalary] = useState("30000");
    const [unpaid, setUnpaid] = useState("9.33");
    const [workDays, setWorkDays] = useState(String(days));
    const m = Number(salary) || 0;
    const u = Number(unpaid) || 0;
    const d = Number(workDays) || 0;
    const daily = d > 0 ? round2(m / d) : 0;
    const hourly = d > 0 ? m / d / hpd : 0;
    const basic = round2(monthly ? m : m / 2);
    const absences = round2(u * hourly);

    return (
        <section className="ocs-card grid gap-4">
            <div>
                <p className="ocs-eyebrow">Try it</p>
                <h3 className="text-lg font-semibold">Worked example</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid content-start gap-2">
                    <Label htmlFor="ex_salary">Monthly salary</Label>
                    <Input
                        id="ex_salary"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                    />
                </div>
                <div className="grid content-start gap-2">
                    <Label htmlFor="ex_unpaid">Unpaid hours</Label>
                    <Input
                        id="ex_unpaid"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={unpaid}
                        onChange={(e) => setUnpaid(e.target.value)}
                    />
                </div>
                <div className="grid content-start gap-2">
                    <Label htmlFor="ex_days">Working days</Label>
                    <Input
                        id="ex_days"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="31"
                        value={workDays}
                        onChange={(e) => setWorkDays(e.target.value)}
                    />
                </div>
            </div>
            <dl className="grid gap-2 text-sm">
                <Line name="Daily rate" value={peso(daily)} />
                <Line name="Hourly rate" value={`${peso(round2(hourly))}`} />
                <Line
                    name={monthly ? "Basic pay (month)" : "Basic pay (cut-off)"}
                    value={peso(basic)}
                />
                <Line
                    name={`Absences (${u} h)`}
                    value={`− ${peso(absences)}`}
                />
                <Line
                    name="Gross before holiday pay, overtime and deductions"
                    value={peso(round2(basic - absences))}
                    strong
                />
            </dl>
        </section>
    );
}

function Line({
    name,
    value,
    strong,
}: {
    name: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex items-baseline justify-between gap-4 p-2 ${strong ? "bg-background font-semibold" : ""}`}
        >
            <dt className="min-w-0 text-muted">{name}</dt>
            <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

Formulas.layout = {
    breadcrumbs: [{ title: "Formulas", href: formulasRoute() }],
};
