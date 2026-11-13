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
    tardiness_hours: number;
    tardiness: number;
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

export const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
export const date = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', ...opts }).format(
        new Date(`${iso}T00:00:00Z`),
    );
export const long = (iso: string) =>
    date(iso, { month: 'long', day: 'numeric', year: 'numeric' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The sheet's padding (its print margin), in inches: the letterhead band bleeds through it. */
const PAD = { top: 0.32, x: 0.4, bottom: 0.22 };

/**
 * The payslip, sized to `widthIn` × `heightIn` (half a sheet, or drawn larger for a whole one).
 * Printed documents have their own look, not the app's themes (user, 2026-11-12, "corporate band"):
 * white paper, a deep plum letterhead band, tidy ruled tables and a plum net-pay bar. Colours are the
 * .ocs-doc print palette in app.css. Units are print units so it lays out the same on every paper.
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
            className="ocs-doc payslip-sheet relative flex flex-col overflow-hidden"
            style={{
                width: `${widthIn}in`,
                height: `${heightIn}in`,
                padding: `${PAD.top}in ${PAD.x}in ${PAD.bottom}in`,
                fontSize: '8.5pt',
                lineHeight: 1.4,
            }}
            aria-label={`Payslip for ${p.name}, ${long(p.start)} to ${long(p.end)}`}
        >
            <Letterhead
                company={company}
                title="PAYSLIP"
                reference={`No. ${String(p.id).padStart(5, '0')}`}
                bleed={PAD}
            />

            {/* Who and when */}
            <dl className="grid grid-cols-4 gap-3 border-b border-(--doc-rule) pb-[6pt]">
                <Field label="Employee" value={p.name} />
                <Field label="Position" value={p.position ?? '—'} />
                <Field
                    label="Pay period"
                    value={`${date(p.start, { month: 'short', day: 'numeric' })} – ${date(p.end, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                />
                <Field label="Pay date" value={long(p.issued_on)} />
            </dl>

            {/* Earnings and deductions, side by side */}
            <div className="mt-[7pt] grid grid-cols-2 gap-[0.3in]">
                <Ledger title="Earnings">
                    <Row label="Basic salary" value={peso(p.basic_pay)} />
                    <Row
                        label="Holiday pay"
                        hint={holidayNote || undefined}
                        value={peso(p.holiday_pay)}
                    />
                    <Row
                        label="Absences / Unpaid time-off (PTO)"
                        value={
                            p.absences > 0 ? `(${peso(p.absences)})` : peso(0)
                        }
                    />
                    {/* Older payslips have no lates line; only show it when there's something on it. */}
                    {p.tardiness > 0 && (
                        <Row
                            label="Tardiness"
                            hint={`${p.tardiness_hours.toFixed(2)} h`}
                            value={`(${peso(p.tardiness)})`}
                        />
                    )}
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

            {/* Net pay: the one number that matters. The plum edge is a drawn bar, not a border. */}
            <div className="relative mt-[8pt] flex items-center justify-between bg-(--doc-tint) py-[5pt] pr-[10pt] pl-[13pt]">
                <span
                    className="absolute inset-y-0 left-0 w-[3pt] bg-(--doc-brand)"
                    aria-hidden="true"
                />
                <p
                    className="tracking-[0.18em] text-(--doc-muted) uppercase"
                    style={{ fontSize: '7.5pt' }}
                >
                    Net pay
                </p>
                <p
                    className="font-bold text-(--doc-band) tabular-nums"
                    style={{ fontSize: '15pt' }}
                >
                    {peso(p.net_pay)}
                </p>
            </div>

            {/* Acknowledgement and signature, low on the sheet so there is room to sign. */}
            <div className="mt-auto grid grid-cols-[1.4fr_1fr] items-end gap-[0.35in] pt-[0.3in]">
                <p className="text-(--doc-muted)" style={{ fontSize: '7pt' }}>
                    Please check your payslip and report any discrepancy within
                    two (2) days from the date of payment. I acknowledge receipt
                    of the amount stated above as payment for my services.
                </p>
                <Signature name={p.name} label="Signature over printed name" />
            </div>

            <footer
                className="pt-[0.1in] text-center text-(--doc-muted)"
                style={{ fontSize: '6.5pt' }}
            >
                {company.name} · {company.address} · Confidential
            </footer>
        </article>
    );
}

/**
 * The letterhead band every printed document starts with: the mark (inverted), the company, and the
 * document title on the right. `bleed` is the sheet's padding, so the band runs edge to edge.
 */
export function Letterhead({
    company,
    title,
    reference,
    bleed,
}: {
    company: Company;
    title: string;
    reference?: string;
    bleed: { top: number; x: number };
}) {
    return (
        <header
            className="mb-[8pt] flex items-center gap-[10pt] bg-(--doc-band) text-white"
            style={{
                margin: `-${bleed.top}in -${bleed.x}in 8pt`,
                padding: `0.16in ${bleed.x}in`,
            }}
        >
            <AppLogoMark inverse className="size-[0.42in]" />
            <div className="min-w-0">
                <p className="font-bold" style={{ fontSize: '12pt' }}>
                    {company.name}
                </p>
                <p className="opacity-75" style={{ fontSize: '7.5pt' }}>
                    {company.address}
                </p>
            </div>
            <div className="ml-auto text-right">
                <p
                    className="font-bold tracking-[0.22em]"
                    style={{ fontSize: '13pt' }}
                >
                    {title}
                </p>
                {reference && (
                    <p className="opacity-75" style={{ fontSize: '7pt' }}>
                        {reference}
                    </p>
                )}
            </div>
        </header>
    );
}

export function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt
                className="tracking-[0.12em] text-(--doc-muted) uppercase"
                style={{ fontSize: '6.5pt' }}
            >
                {label}
            </dt>
            <dd className="truncate font-semibold">{value}</dd>
        </div>
    );
}

/** A name over a signing line, with what the line is for underneath. */
export function Signature({ name, label }: { name?: string; label: string }) {
    return (
        <div className="text-center">
            <p className="min-h-[1.3em] font-semibold">{name ?? ''}</p>
            <div
                className="mt-[1pt] h-[0.75pt] bg-(--doc-ink)"
                aria-hidden="true"
            />
            <p
                className="mt-[1pt] text-(--doc-muted)"
                style={{ fontSize: '6.5pt' }}
            >
                {label}
            </p>
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
                className="mb-[2pt] font-bold tracking-[0.15em] text-(--doc-brand) uppercase"
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
            className={`flex items-baseline justify-between gap-3 py-[2pt] ${total ? 'mt-[1pt] border-t-[1.25pt] border-(--doc-band) pt-[3pt] font-bold' : 'border-b border-(--doc-faint)'}`}
        >
            <dt className="min-w-0">
                {label}
                {hint && (
                    <span
                        className="ml-1 text-(--doc-muted)"
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
