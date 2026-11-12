import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { ReleaseForm } from '@/components/payroll-release-document';
import { PayrollReleaseDocument } from '@/components/payroll-release-document';
import type { Company, PayslipData } from '@/components/payslip-document';
import { PayslipDocument } from '@/components/payslip-document';
import type { Paper } from '@/components/print-toolbar';
import { PrintToolbar } from '@/components/print-toolbar';
import { useFitScale } from '@/hooks/use-fit-scale';
import { print as printRoute } from '@/routes/people/payroll/release';

type Props = ReleaseForm & {
    paper: string;
    papers: Paper[];
    company: Company;
    back: string;
    payslips: PayslipData[];
};

/**
 * The printable Payroll Release Form (HR): a full portrait page of the chosen paper, more pages when the
 * list runs long. On screen it's a scaled preview with the paper picker and Print.
 */
export default function PrintPayrollRelease({
    paper,
    papers,
    company,
    back,
    payslips,
    ...form
}: Props) {
    const size = papers.find((p) => p.value === paper) ?? papers[0];
    const [stage, scale] = useFitScale(size.w);
    // The sheet grows with the list, so the scaled box measures it rather than assuming one page.
    const sheet = useRef<HTMLDivElement>(null);
    const [heightPx, setHeightPx] = useState(size.h * 96);

    useEffect(() => {
        const el = sheet.current;
        if (!el) {
            return;
        }
        const observer = new ResizeObserver(() => setHeightPx(el.offsetHeight));
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <Head title="Payroll release form" />
            {/*
             * The page box has no margins, so the payslip sheets after the form can print edge to edge
             * (Chrome keeps one content width for the whole flow). The form's padding is its margin, and
             * box-decoration-break repeats it on every page a long form runs onto. Sheets are a hair
             * shorter than the paper so rounding never spills a blank page.
             */}
            <style>{`
                @page { size: ${size.w}in ${size.h}in; margin: 0; }
                @media print {
                    html, body { background: #fff !important; }
                    .ocs-bg, .no-print, [data-sonner-toaster] { display: none !important; }
                    .print-stage { padding: 0 !important; }
                    .print-box { width: auto !important; height: auto !important; margin: 0 !important; }
                    .print-scale { transform: none !important; box-shadow: none !important; }
                    .release-sheet {
                        min-height: ${(size.h - 0.03).toFixed(2)}in !important;
                        box-decoration-break: clone; -webkit-box-decoration-break: clone;
                    }
                    .release-row { break-inside: avoid; }
                    .payslip-pair { break-before: page; margin: 0 !important; height: ${(size.h - 0.03).toFixed(2)}in !important; }
                }
            `}</style>

            <PrintToolbar
                back={back}
                paper={paper}
                papers={papers}
                paperUrl={(p) =>
                    printRoute({
                        query: { cutoff: form.period.start, paper: p },
                    }).url
                }
            />

            <main
                ref={stage}
                className="print-stage overflow-x-hidden px-4 py-6"
            >
                <p className="no-print mb-3 text-center text-sm text-muted">
                    Prints on {size.label}, portrait: the release form, then
                    each payslip on half a sheet, two to a page (cut along the
                    middle). Each person signs on their line when they receive
                    their pay.
                </p>
                <div
                    className="print-box mx-auto"
                    style={{
                        width: `calc(${size.w}in * ${scale})`,
                        height: heightPx * scale,
                    }}
                >
                    <div
                        ref={sheet}
                        className="print-scale origin-top-left shadow-lift"
                        style={{
                            width: `${size.w}in`,
                            transform: `scale(${scale})`,
                        }}
                    >
                        <PayrollReleaseDocument
                            form={form}
                            company={company}
                            widthIn={size.w}
                            minHeightIn={size.h}
                        />
                        {pairs(payslips).map((pair) => (
                            <section
                                key={pair[0].id}
                                className="ocs-doc payslip-pair relative mt-[0.3in]"
                                style={{
                                    width: `${size.w}in`,
                                    height: `${size.h}in`,
                                }}
                            >
                                {pair.map((slip) => (
                                    <PayslipDocument
                                        key={slip.id}
                                        payslip={slip}
                                        company={company}
                                        widthIn={size.w}
                                        heightIn={size.h / 2}
                                    />
                                ))}
                                {pair.length === 2 && <CutLine />}
                            </section>
                        ))}
                    </div>
                </div>
            </main>
        </>
    );
}

/** Payslips two at a time: the top and bottom halves of one sheet. */
function pairs(slips: PayslipData[]): PayslipData[][] {
    const out: PayslipData[][] = [];
    for (let i = 0; i < slips.length; i += 2) {
        out.push(slips.slice(i, i + 2));
    }

    return out;
}

/**
 * Where to cut a sheet of two payslips: just above the middle, in the top payslip's bottom margin, so
 * it never runs over the second payslip's letterhead band.
 */
function CutLine() {
    return (
        <div
            className="absolute inset-x-0 flex -translate-y-full items-center gap-2 px-[0.2in] text-(--doc-muted)"
            style={{ top: '50%', fontSize: '6pt' }}
            aria-hidden="true"
        >
            <span className="h-0 flex-1 border-t border-dashed border-current opacity-60" />
            ✂ cut here
            <span className="h-0 flex-1 border-t border-dashed border-current opacity-60" />
        </div>
    );
}
