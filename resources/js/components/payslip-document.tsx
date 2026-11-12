import { AppLogoMark } from '@/components/app-logo';

export type PayslipData = {
    id: number;
    name: string;
    position: string | null;
    start: string;
    end: string;
    issued_on: string;
    monthly_salary: number;
    daily_rate: number;
    basic_pay: number;
    holiday_regular_days: number;
    holiday_special_days: number;
    holiday_pay: number;
    unpaid_hours: number;
    absences: number;
    overtime_allowance: number;
    gross_pay: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    withholding_tax: number;
    cash_advance: number;
    total_deductions: number;
    net_pay: number;
};

export type Company = { name: string; address: string };

const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
const date = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
const long = (iso: string) =>
    date(iso, { month: 'long', day: 'numeric', year: 'numeric' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The payslip, sized to the crosswise half of the paper (`widthIn` × `heightIn`). Always the light
 * "paper" theme: a drafting-desk feel (faint blueprint grid, mono labels, a little orchid by the net
 * pay) on a sober, professional layout. Units are print units so it lays out the same on every paper.
 */
export function PayslipDocument({
    payslip: p,
    company,
    widthIn,
    heightIn,
}: {
    payslip: PayslipData;
    company: Company;
    widthIn: number;
    heightIn: number;
}) {
    const holidayNote = [
        p.holiday_regular_days > 0 &&
            plural(p.holiday_regular_days, 'regular holiday'),
        p.holiday_special_days > 0 &&
            plural(p.holiday_special_days, 'special day'),
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <article
            data-theme="light"
            className="payslip-sheet relative flex flex-col overflow-hidden bg-bg text-ink"
            style={{
                width: `${widthIn}in`,
                height: `${heightIn}in`,
                padding: '0.32in 0.4in 0.22in',
                fontSize: '8.5pt',
                lineHeight: 1.35,
                // A faint blueprint grid: the paper theme's own texture, quiet enough to read through.
                backgroundImage:
                    'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
                backgroundSize: '0.25in 0.25in',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
            }}
            aria-label={`Payslip for ${p.name}, ${long(p.start)} to ${long(p.end)}`}
        >
            {/* Letterhead */}
            <header className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <AppLogoMark className="size-[0.5in]" />
                    <div>
                        <p className="font-bold" style={{ fontSize: '12pt' }}>
                            {company.name}
                        </p>
                        <p className="text-muted" style={{ fontSize: '7.5pt' }}>
                            {company.address}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p
                        className="font-mono font-bold tracking-[0.2em] text-primary"
                        style={{ fontSize: '13pt' }}
                    >
                        PAYSLIP
                    </p>
                    <p
                        className="font-mono text-muted"
                        style={{ fontSize: '7pt' }}
                    >
                        No. {String(p.id).padStart(5, '0')}
                    </p>
                </div>
            </header>
            <div className="mt-2 h-[1.5pt] bg-accent" aria-hidden="true" />

            {/* Who and when */}
            <dl className="mt-2 grid grid-cols-4 gap-3">
                <Field label="Name" value={p.name} />
                <Field label="Position" value={p.position ?? '—'} />
                <Field
                    label="Payroll period"
                    value={`${date(p.start, { month: 'short', day: 'numeric' })} – ${date(p.end, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                />
                <Field label="Issue date" value={long(p.issued_on)} />
            </dl>

            {/* Earnings and deductions, side by side */}
            <div className="mt-3 grid grid-cols-2 gap-5">
                <Ledger title="Earnings">
                    <Row
                        label="Basic monthly salary"
                        hint={`½ of ${peso(p.monthly_salary)} for this cut-off`}
                        value={peso(p.basic_pay)}
                    />
                    <Row
                        label="Holiday pay"
                        hint={
                            holidayNote ? `Worked: ${holidayNote}` : undefined
                        }
                        value={peso(p.holiday_pay)}
                    />
                    <Row
                        label="Absences / Unpaid time-off (PTO)"
                        hint={
                            p.unpaid_hours > 0
                                ? `${p.unpaid_hours.toFixed(2)} h unpaid`
                                : undefined
                        }
                        value={
                            p.absences > 0 ? `(${peso(p.absences)})` : peso(0)
                        }
                    />
                    <Row
                        label="Overtime / Allowance"
                        value={peso(p.overtime_allowance)}
                    />
                    <Row label="Gross pay" value={peso(p.gross_pay)} total />
                </Ledger>
                <Ledger title="Deductions">
                    <Row label="SSS" value={peso(p.sss)} />
                    <Row label="PhilHealth" value={peso(p.philhealth)} />
                    <Row label="Pag-IBIG" value={peso(p.pagibig)} />
                    <Row
                        label="Withholding tax"
                        value={peso(p.withholding_tax)}
                    />
                    <Row
                        label="Cash advance / Company loan"
                        value={peso(p.cash_advance)}
                    />
                    <Row
                        label="Total deductions"
                        value={peso(p.total_deductions)}
                        total
                    />
                </Ledger>
            </div>

            {/* Net pay: the one number that matters, with a small orchid for company */}
            <div className="mt-3 flex items-center justify-between bg-surface px-3 py-2">
                <p
                    className="font-mono tracking-[0.15em] text-muted"
                    style={{ fontSize: '7.5pt' }}
                >
                    NET PAY
                </p>
                <p className="flex items-center gap-2">
                    <Orchid />
                    <span className="font-bold" style={{ fontSize: '15pt' }}>
                        {peso(p.net_pay)}
                    </span>
                </p>
            </div>

            {/* Acknowledgement and signature */}
            {/* Sits low on the sheet, so there is always room to sign above the name. */}
            <div className="mt-auto grid grid-cols-[1.4fr_1fr] items-end gap-6 pt-[0.3in]">
                <p className="text-muted" style={{ fontSize: '7pt' }}>
                    Please check your payslip and report any discrepancy within
                    two (2) days from the date of payment. I acknowledge receipt
                    of the amount stated above as payment for my services.
                </p>
                <div className="text-center">
                    <p className="font-semibold" style={{ fontSize: '8.5pt' }}>
                        {p.name}
                    </p>
                    <div className="mt-0.5 h-px bg-ink" aria-hidden="true" />
                    <p
                        className="mt-0.5 text-muted"
                        style={{ fontSize: '6.5pt' }}
                    >
                        Signature over printed name (Employee)
                    </p>
                </div>
            </div>

            {/* Company footer, bottom centre */}
            <footer
                className="pt-[0.12in] text-center font-mono text-muted"
                style={{ fontSize: '6.5pt' }}
            >
                {company.name} · {company.address}
            </footer>
        </article>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt
                className="font-mono tracking-[0.12em] text-muted uppercase"
                style={{ fontSize: '6.5pt' }}
            >
                {label}
            </dt>
            <dd className="truncate font-semibold">{value}</dd>
        </div>
    );
}

function Ledger({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h2
                className="mb-1 font-mono tracking-[0.12em] text-primary uppercase"
                style={{ fontSize: '7pt' }}
            >
                {title}
            </h2>
            <dl className="grid">{children}</dl>
        </section>
    );
}

function Row({
    label,
    hint,
    value,
    total = false,
}: {
    label: string;
    hint?: string;
    value: string;
    total?: boolean;
}) {
    return (
        <div
            className={`relative flex items-baseline justify-between gap-3 py-[1.5pt] ${total ? 'mt-[3pt] pt-[3pt] font-bold' : ''}`}
        >
            {/* A total gets a hairline rule above it (a drawn line: print engines box an inset shadow). */}
            {total && (
                <span
                    className="absolute inset-x-0 top-0 h-[0.75pt] bg-muted"
                    aria-hidden="true"
                />
            )}
            <dt className="min-w-0">
                {label}
                {hint && (
                    <span
                        className="ml-1 text-muted"
                        style={{ fontSize: '6.5pt' }}
                    >
                        {hint}
                    </span>
                )}
            </dt>
            <dd className="shrink-0 tabular-nums">{value}</dd>
        </div>
    );
}

/** The dock's five-petal orchid, small: petals in primary, centre in accent. */
function Orchid() {
    return (
        <svg viewBox="-12 -12 24 24" className="size-[11pt]" aria-hidden="true">
            {[0, 72, 144, 216, 288].map((deg) => (
                <ellipse
                    key={deg}
                    cx="0"
                    cy="-5.4"
                    rx="3.4"
                    ry="5.6"
                    transform={`rotate(${deg})`}
                    className="fill-primary"
                />
            ))}
            <circle r="2.6" className="fill-accent" />
        </svg>
    );
}
