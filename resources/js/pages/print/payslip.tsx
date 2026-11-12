import { Head } from '@inertiajs/react';
import type { Company, PayslipData } from '@/components/payslip-document';
import { PayslipDocument } from '@/components/payslip-document';
import type { Paper } from '@/components/print-toolbar';
import { PrintToolbar } from '@/components/print-toolbar';
import { useFitScale } from '@/hooks/use-fit-scale';
import { print as printRoute } from '@/routes/payslips';

type Props = {
    paper: string;
    papers: Paper[];
    company: Company;
    back: string;
    payslip: PayslipData;
};

/** On a whole sheet the payslip is the half-sheet design drawn this much larger, so it fills the page. */
const FULL_SHEET_ZOOM = 1.3;

/**
 * One printable payslip on a whole sheet of the chosen paper. (The Payroll Release Form prints every
 * payslip of a cut-off at half size, two to a sheet.) On screen it's a preview with the paper picker.
 */
export default function PrintPayslip({
    paper,
    papers,
    company,
    back,
    payslip,
}: Props) {
    const size = papers.find((p) => p.value === paper) ?? papers[0];
    const [stage, scale] = useFitScale(size.w);

    return (
        <>
            <Head title={`Payslip · ${payslip.name}`} />
            <style>{`
                @page { size: ${size.w}in ${size.h}in; margin: 0; }
                @media print {
                    html, body { background: #fff !important; }
                    .ocs-bg, .no-print, [data-sonner-toaster] { display: none !important; }
                    .print-stage { padding: 0 !important; }
                    .print-box { width: auto !important; height: auto !important; margin: 0 !important; }
                    .print-scale { transform: none !important; box-shadow: none !important; }
                }
            `}</style>

            <PrintToolbar
                back={back}
                paper={paper}
                papers={papers}
                paperUrl={(p) =>
                    printRoute(payslip.id, { query: { paper: p } }).url
                }
            />

            <main
                ref={stage}
                className="print-stage overflow-x-hidden px-4 py-6"
            >
                <p className="no-print mb-3 text-center text-sm text-muted">
                    Prints on a whole {size.label} sheet.
                </p>
                {/* The outer box takes the scaled size so it centres; the sheet keeps its real size. */}
                <div
                    className="print-box mx-auto"
                    style={{
                        width: `calc(${size.w}in * ${scale})`,
                        height: `calc(${size.h}in * ${scale})`,
                    }}
                >
                    <div
                        className="print-scale origin-top-left overflow-hidden shadow-lift"
                        style={{
                            width: `${size.w}in`,
                            height: `${size.h}in`,
                            transform: `scale(${scale})`,
                        }}
                    >
                        <div
                            className="origin-top-left"
                            style={{ transform: `scale(${FULL_SHEET_ZOOM})` }}
                        >
                            <PayslipDocument
                                payslip={payslip}
                                company={company}
                                widthIn={size.w / FULL_SHEET_ZOOM}
                                heightIn={size.h / FULL_SHEET_ZOOM}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
