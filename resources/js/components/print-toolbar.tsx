import { router } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type Paper = { value: string; label: string; w: number; h: number };

/**
 * The bar above a print preview: Back, the paper picker and Print. Hidden when printing.
 * `paperUrl` gives the same page's URL for another paper.
 */
export function PrintToolbar({
    back,
    paper,
    papers,
    paperUrl,
}: {
    back: string;
    paper: string;
    papers: Paper[];
    paperUrl: (paper: string) => string;
}) {
    return (
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-surface px-4 py-3 shadow-lift">
            <BackButton href={back} className="bg-bg" />
            <div className="ml-auto flex flex-wrap items-center gap-3">
                <label htmlFor="paper" className="text-sm text-muted">
                    Paper
                </label>
                <Select
                    value={paper}
                    onValueChange={(p) =>
                        router.get(
                            paperUrl(p),
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
    );
}
