import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

/** Today on this device, as Y-m-d (not UTC: the office is in Manila). */
const today = () => {
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const long = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Marking pay received (HR and admin): on the day it was handed out, today by default. An earlier day
 * records a payroll that was paid before it was put into Luna; the server refuses a future one.
 */
export function MarkReceivedDialog({
    url,
    data = {},
    title,
    description,
    payday,
    trigger,
}: {
    /** PATCH one payslip's release, or POST mark-all. */
    url: { url: string; method: 'patch' | 'post' };
    data?: Record<string, string | boolean>;
    title: string;
    description: string;
    /** The pay period's last day: offered as a one-tap pick when it has passed. */
    payday?: string;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [on, setOn] = useState(today());
    const [error, setError] = useState<string | undefined>();
    const [processing, setProcessing] = useState(false);
    const max = today();
    const picks = [
        { label: 'Today', value: max },
        ...(payday && payday < max
            ? [{ label: `Payday · ${long(payday)}`, value: payday }]
            : []),
    ];

    const submit = () =>
        router[url.method](
            url.url,
            { ...data, released_on: on },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => {
                    setOpen(false);
                    setError(undefined);
                },
                onError: (e) => setError(e.released_on ?? Object.values(e)[0]),
            },
        );

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (o) {
                    setOn(today());
                    setError(undefined);
                }
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="Quick dates"
                    >
                        {picks.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => setOn(p.value)}
                                aria-pressed={on === p.value}
                                className="min-h-10 bg-surface-hover px-3 text-sm font-semibold text-ink hover:shadow-lift aria-pressed:bg-primary aria-pressed:text-on-primary"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="released_on">Received on</Label>
                        <Input
                            id="released_on"
                            type="date"
                            value={on}
                            max={max}
                            onChange={(e) => setOn(e.target.value)}
                            required
                        />
                        <InputError message={error} />
                    </div>
                    <Button
                        type="submit"
                        disabled={processing || on === ''}
                        className="justify-self-start"
                    >
                        {processing && <Spinner />}
                        Mark received
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
