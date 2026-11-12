import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Company, PayslipData } from '@/components/payslip-document';
import { PayslipDocument } from '@/components/payslip-document';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { print as printRoute } from '@/routes/payslips';

type Paper = { value: string; label: string; w: number; h: number };

type Props = {
    paper: string;
    papers: Paper[];
    company: Company;
    back: string;
    payslip: PayslipData;
};

/**
 * The printable payslip. The sheet is the chosen paper; the payslip fills its top half (crosswise),
 * so it can be cut along the middle. On screen it's a preview with the paper picker and Print.
 */
export default function PrintPayslip({
    paper,
    papers,
    company,
    back,
    payslip,
}: Props) {
    const size = papers.find((p) => p.value === paper) ?? papers[0];
    const half = size.h / 2;
    const [stage, scale] = useFitScale(size.w);

    return (
        <>
            <Head title={`Payslip · ${payslip.name}`} />
            {/* The page box is the whole paper; the payslip sits in its top half. */}
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

            <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-surface px-4 py-3 shadow-lift">
                <Button variant="ghost" size="sm" className="min-h-10" asChild>
                    <Link href={back}>
                        <ArrowLeft /> Back
                    </Link>
                </Button>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <label htmlFor="paper" className="text-sm text-muted">
                        Paper
                    </label>
                    <Select
                        value={paper}
                        onValueChange={(p) =>
                            router.get(
                                printRoute(payslip.id, { query: { paper: p } })
                                    .url,
                                {},
                                { preserveScroll: true, replace: true },
                            )
                        }
                    >
                        <SelectTrigger id="paper" className="w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {papers.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => window.print()}>
                        <Printer /> Print
                    </Button>
                </div>
            </div>

            <main
                ref={stage}
                className="print-stage overflow-x-hidden px-4 py-6"
            >
                <p className="no-print mb-3 text-center text-sm text-muted">
                    Prints on the top half of a {size.label} sheet ({size.w} ×{' '}
                    {half} in). Cut along the middle.
                </p>
                {/* The outer box takes the scaled size so it centres; the sheet keeps its real size. */}
                <div
                    className="print-box mx-auto"
                    style={{
                        width: `calc(${size.w}in * ${scale})`,
                        height: `calc(${half}in * ${scale})`,
                    }}
                >
                    <div
                        className="print-scale origin-top-left shadow-lift"
                        style={{
                            width: `${size.w}in`,
                            transform: `scale(${scale})`,
                        }}
                    >
                        <PayslipDocument
                            payslip={payslip}
                            company={company}
                            widthIn={size.w}
                            heightIn={half}
                        />
                    </div>
                </div>
                {/* Where to cut: printed only, at the halfway mark. */}
                <div
                    data-theme="light"
                    className="cut-line hidden items-center gap-2 font-mono text-muted print:flex"
                    style={{ width: `${size.w}in`, fontSize: '6pt' }}
                    aria-hidden="true"
                >
                    <span className="h-0 flex-1 border-t border-dashed border-current opacity-50" />
                    ✂ cut here
                    <span className="h-0 flex-1 border-t border-dashed border-current opacity-50" />
                </div>
            </main>
        </>
    );
}

/**
 * Shrinks the true-size preview to fit the stage (printing always uses the real size). Measures the
 * stage, not the window: on phones an overflowing sheet makes the browser zoom out, which would
 * inflate window.innerWidth and keep the preview at full size.
 */
function useFitScale(widthIn: number) {
    const stage = useRef<HTMLElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const el = stage.current;
        if (!el) {
            return;
        }
        const fit = () => {
            const style = getComputedStyle(el);
            const inner =
                el.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight);
            setScale(Math.min(1, inner / (widthIn * 96)));
        };
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        fit();

        return () => observer.disconnect();
    }, [widthIn]);

    return [stage, scale] as const;
}
