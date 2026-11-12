import type { Company } from '@/components/payslip-document';
import {
    date,
    Field,
    Letterhead,
    long,
    peso,
    Signature,
} from '@/components/payslip-document';

export type ReleaseRow = {
    id: number;
    name: string;
    position: string | null;
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
    released_on: string | null;
};

export type ReleaseTotals = {
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
};

export type ReleaseForm = {
    period: { start: string; end: string };
    printed_on: string;
    prepared_by: string;
    rows: ReleaseRow[];
    totals: ReleaseTotals;
};

const short = (iso: string) =>
    date(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** The sheet's padding (its print margin on every page), in inches: the letterhead band bleeds through it. */
const PAD = { top: 0.45, x: 0.5, bottom: 0.35 };

/**
 * The Payroll Release Form: one line per payslip of the cut-off, each with the net pay, the date received
 * and room to sign. Same document look as the payslip (plum letterhead band, white paper, ruled table;
 * .ocs-doc palette). A full portrait page that runs onto more pages when needed: rows never split, and
 * the column headings repeat on every printed page.
 */
export function PayrollReleaseDocument({
    form: f,
    company,
    widthIn,
    minHeightIn,
}: {
    form: ReleaseForm;
    company: Company;
    widthIn: number;
    minHeightIn: number;
}) {
    const range = `${date(f.period.start, { month: 'short', day: 'numeric' })} – ${short(f.period.end)}`;

    return (
        <article
            className="ocs-doc release-sheet relative flex flex-col"
            style={{
                width: `${widthIn}in`,
                minHeight: `${minHeightIn}in`,
                padding: `${PAD.top}in ${PAD.x}in ${PAD.bottom}in`,
                fontSize: '8.5pt',
                lineHeight: 1.4,
            }}
            aria-label={`Payroll release form, ${long(f.period.start)} to ${long(f.period.end)}`}
        >
            <Letterhead
                company={company}
                title="PAYROLL RELEASE"
                reference={`Form No. PR-${f.period.start}`}
                bleed={PAD}
            />

            <dl className="grid grid-cols-4 gap-3 border-b border-(--doc-rule) pb-[6pt]">
                <Field label="Pay period" value={range} />
                <Field label="Employees" value={String(f.rows.length)} />
                <Field label="Total net pay" value={peso(f.totals.net_pay)} />
                <Field label="Prepared on" value={long(f.printed_on)} />
            </dl>

            <p
                className="mt-[7pt] text-(--doc-muted)"
                style={{ fontSize: '7.5pt' }}
            >
                We, the undersigned employees of {company.name}, acknowledge
                that we received our salary for the pay period {range}, in the
                net amount shown opposite our names, and that the amount is
                correct and complete.
            </p>

            <table
                className="mt-[8pt] w-full border-collapse tabular-nums"
                style={{ fontSize: '8pt' }}
            >
                <thead>
                    <tr
                        className="border-b-[1.25pt] border-(--doc-band) font-bold tracking-[0.12em] text-(--doc-brand) uppercase"
                        style={{ fontSize: '6.5pt' }}
                    >
                        <Th className="w-[0.3in] text-left">No.</Th>
                        <Th className="text-left">Employee</Th>
                        <Th className="w-[0.95in] text-right">Gross pay</Th>
                        <Th className="w-[0.85in] text-right">Deductions</Th>
                        <Th className="w-[0.95in] text-right">Net pay</Th>
                        <Th className="w-[0.9in] text-center">Date received</Th>
                        <Th className="w-[1.6in] text-center">Signature</Th>
                    </tr>
                </thead>
                <tbody>
                    {f.rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={7}
                                className="py-4 text-center text-(--doc-muted)"
                            >
                                No payslips for this cut-off yet.
                            </td>
                        </tr>
                    )}
                    {f.rows.map((r, i) => (
                        <tr
                            key={r.id}
                            className="release-row border-b border-(--doc-rule)"
                            style={{ height: '0.46in' }}
                        >
                            <Td className="text-(--doc-muted)">{i + 1}</Td>
                            <Td>
                                <p className="font-semibold">{r.name}</p>
                                <p
                                    className="text-(--doc-muted)"
                                    style={{ fontSize: '6.5pt' }}
                                >
                                    {r.position ?? '—'}
                                </p>
                            </Td>
                            <Td className="text-right">{peso(r.gross_pay)}</Td>
                            <Td className="text-right">
                                {peso(r.total_deductions)}
                            </Td>
                            <Td className="text-right font-bold">
                                {peso(r.net_pay)}
                            </Td>
                            <Td className="text-center">
                                {r.released_on ? (
                                    short(r.released_on)
                                ) : (
                                    <SignLine />
                                )}
                            </Td>
                            <Td>
                                <SignLine />
                            </Td>
                        </tr>
                    ))}
                </tbody>
                {f.rows.length > 0 && (
                    <tfoot className="release-row">
                        <tr className="bg-(--doc-tint) font-bold text-(--doc-band)">
                            <Td colSpan={2}>Total</Td>
                            <Td className="text-right">
                                {peso(f.totals.gross_pay)}
                            </Td>
                            <Td className="text-right">
                                {peso(f.totals.total_deductions)}
                            </Td>
                            <Td className="text-right">
                                {peso(f.totals.net_pay)}
                            </Td>
                            <Td colSpan={2} />
                        </tr>
                    </tfoot>
                )}
            </table>

            {/* Sign-off: pushed low on a short list, kept whole on a long one. */}
            <div className="release-row mt-auto grid grid-cols-3 gap-[0.4in] pt-[0.5in]">
                <Signature name={f.prepared_by} label="Prepared by" />
                <Signature label="Checked by" />
                <Signature label="Approved by" />
            </div>

            <footer
                className="pt-[0.2in] text-center text-(--doc-muted)"
                style={{ fontSize: '6.5pt' }}
            >
                {company.name} · {company.address} · Confidential
            </footer>
        </article>
    );
}

function Th({
    className = '',
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return <th className={`px-[4pt] pb-[4pt] ${className}`}>{children}</th>;
}

function Td({
    className = '',
    colSpan,
    children,
}: {
    className?: string;
    colSpan?: number;
    children?: React.ReactNode;
}) {
    return (
        <td
            colSpan={colSpan}
            className={`px-[4pt] py-[4pt] align-middle ${className}`}
        >
            {children}
        </td>
    );
}

/** A line to write on. */
function SignLine() {
    return (
        <div
            className="mt-[10pt] h-[0.75pt] bg-(--doc-muted)"
            aria-hidden="true"
        />
    );
}
