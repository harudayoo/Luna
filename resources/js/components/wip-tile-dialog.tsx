import { router, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import WipTileController from '@/actions/App/Http/Controllers/WipTileController';
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

export type WipTile = {
    id: number;
    tag: string;
    name: string;
    about: string | null;
    url: string;
};

const PRESETS = ['OCS', 'QSS'] as const;

/**
 * Pin one of your own WIP channels on Home, or edit/unpin one you pinned. Tag: OCS, QSS, or Custom (up to
 * 4 letters or numbers). The link must be a WIP link; the server checks it too (WipTileRequest).
 */
export function WipTileDialog({
    tile,
    trigger,
}: {
    /** Omit to pin a new one. */
    tile?: WipTile;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);
    const initialCustom =
        tile && !PRESETS.includes(tile.tag as (typeof PRESETS)[number]);
    const [custom, setCustom] = useState(Boolean(initialCustom));
    const form = useForm({
        tag: tile?.tag ?? 'OCS',
        name: tile?.name ?? '',
        about: tile?.about ?? '',
        url: tile?.url ?? '',
    });
    const { data, setData, errors, processing } = form;
    const id = (f: string) => `wip-tile-${tile?.id ?? 'new'}-${f}`;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.submit(
            tile
                ? WipTileController.update(tile.id)
                : WipTileController.store(),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setOpen(false);
                    if (!tile) {
                        form.reset();
                        setCustom(false);
                    }
                },
            },
        );
    };

    const remove = () =>
        tile &&
        router.delete(WipTileController.destroy.url(tile.id), {
            preserveScroll: true,
            onStart: () => setRemoving(true),
            onFinish: () => setRemoving(false),
            onSuccess: () => setOpen(false),
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                    setConfirmRemove(false);
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                {confirmRemove && tile ? (
                    <div className="grid gap-4">
                        <DialogTitle>Unpin #{tile.name}?</DialogTitle>
                        <DialogDescription>
                            It comes off your Home. The channel stays on WIP.
                        </DialogDescription>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setConfirmRemove(false)}
                            >
                                Keep it
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={removing}
                                onClick={remove}
                            >
                                {removing && <Spinner />}
                                Unpin
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogTitle>
                            {tile ? `Edit #${tile.name}` : 'Pin a WIP channel'}
                        </DialogTitle>
                        <DialogDescription>
                            {tile
                                ? 'Only you see your pinned channels.'
                                : 'It shows on your Home, under the office channels. Only you see it.'}
                        </DialogDescription>

                        <form onSubmit={submit} className="grid gap-4">
                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">
                                    Tag
                                </legend>
                                <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1">
                                    {[...PRESETS, 'Custom'].map((t) => {
                                        const isCustom = t === 'Custom';
                                        const checked = isCustom
                                            ? custom
                                            : !custom && data.tag === t;

                                        return (
                                            <label
                                                key={t}
                                                className="flex min-h-11 cursor-pointer items-center justify-center px-2 text-sm font-semibold text-muted has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:shadow-lift"
                                            >
                                                <input
                                                    type="radio"
                                                    name={id('tag-kind')}
                                                    value={t}
                                                    checked={checked}
                                                    onChange={() => {
                                                        setCustom(isCustom);
                                                        setData(
                                                            'tag',
                                                            isCustom ? '' : t,
                                                        );
                                                    }}
                                                    className="sr-only"
                                                />
                                                {t}
                                            </label>
                                        );
                                    })}
                                </div>
                                {custom && (
                                    <div className="grid gap-2">
                                        <Label htmlFor={id('tag')}>
                                            Your tag (up to 4 letters or
                                            numbers)
                                        </Label>
                                        <Input
                                            id={id('tag')}
                                            required
                                            autoFocus
                                            maxLength={4}
                                            autoCapitalize="characters"
                                            autoComplete="off"
                                            placeholder="TEAM"
                                            className="font-mono uppercase"
                                            value={data.tag}
                                            onChange={(e) =>
                                                setData(
                                                    'tag',
                                                    e.target.value
                                                        .replace(
                                                            /[^a-z0-9]/gi,
                                                            '',
                                                        )
                                                        .toUpperCase(),
                                                )
                                            }
                                        />
                                    </div>
                                )}
                                <InputError message={errors.tag} />
                            </fieldset>

                            <div className="grid gap-2">
                                <Label htmlFor={id('name')}>Channel name</Label>
                                <Input
                                    id={id('name')}
                                    required
                                    maxLength={40}
                                    autoComplete="off"
                                    placeholder="e.g. design-team"
                                    className="font-mono"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={id('about')}>
                                    Short description (optional)
                                </Label>
                                <Input
                                    id={id('about')}
                                    maxLength={80}
                                    autoComplete="off"
                                    placeholder="e.g. Mockups and design reviews."
                                    value={data.about}
                                    onChange={(e) =>
                                        setData('about', e.target.value)
                                    }
                                />
                                <InputError message={errors.about} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={id('url')}>WIP link</Label>
                                <Input
                                    id={id('url')}
                                    type="url"
                                    inputMode="url"
                                    required
                                    maxLength={500}
                                    autoComplete="off"
                                    placeholder="https://wip.quicksilversystems.com/…"
                                    value={data.url}
                                    onChange={(e) =>
                                        setData('url', e.target.value)
                                    }
                                />
                                <p className="text-sm text-muted">
                                    In WIP, open the channel and copy the
                                    address from the browser.
                                </p>
                                <InputError message={errors.url} />
                            </div>

                            <InputError
                                message={
                                    (errors as Record<string, string>).tiles
                                }
                            />

                            <div
                                className={`grid gap-2 ${tile ? 'grid-cols-2' : ''}`}
                            >
                                {tile && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setConfirmRemove(true)}
                                    >
                                        Unpin
                                    </Button>
                                )}
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    {tile ? 'Save' : 'Pin it'}
                                </Button>
                            </div>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
