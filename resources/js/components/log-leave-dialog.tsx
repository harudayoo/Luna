import { Form } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { RouteFormDefinition } from '@/wayfinder';

/**
 * Logging leave: a day, a half day or a range, with an optional note. Used for your own leave
 * (My leave) and by HR for someone else's (Leave & pay); the server applies the rules.
 */
export function LogLeaveDialog({
    form,
    title,
    description,
    trigger,
    defaultFrom,
    idPrefix = 'leave',
}: {
    form: RouteFormDefinition<'post'>;
    title: string;
    description: string;
    trigger: ReactNode;
    /** Y-m-d the "From" field starts on. */
    defaultFrom: string;
    /** Keeps field ids unique when a page has several dialogs. */
    idPrefix?: string;
}) {
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState('');
    const range = to !== '' && to !== from;
    const id = (field: string) => `${idPrefix}-${field}`;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>

                <Form
                    {...form}
                    resetOnSuccess
                    options={{ preserveScroll: true }}
                    onSuccess={() => {
                        setOpen(false);
                        setTo('');
                    }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            {/* Side by side only when both date pickers fit. */}
                            <div className="grid gap-3 min-[400px]:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor={id('from')}>From</Label>
                                    <Input
                                        id={id('from')}
                                        name="from"
                                        type="date"
                                        required
                                        value={from}
                                        onChange={(e) =>
                                            setFrom(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor={id('to')}>
                                        To (optional)
                                    </Label>
                                    <Input
                                        id={id('to')}
                                        name="to"
                                        type="date"
                                        min={from}
                                        value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            <InputError message={errors.from ?? errors.to} />

                            <div className="flex min-h-10 items-center gap-3">
                                <Checkbox
                                    id={id('half')}
                                    name="half_day"
                                    value="1"
                                    disabled={range}
                                />
                                <Label
                                    htmlFor={id('half')}
                                    className={range ? 'text-muted' : ''}
                                >
                                    Half day {range && '(single dates only)'}
                                </Label>
                            </div>
                            <InputError message={errors.half_day} />

                            <div className="grid gap-2">
                                <Label htmlFor={id('note')}>
                                    Note (optional)
                                </Label>
                                <Input
                                    id={id('note')}
                                    name="note"
                                    maxLength={80}
                                    placeholder="e.g. Dentist, family trip"
                                />
                                <InputError message={errors.note} />
                            </div>

                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Log leave
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
