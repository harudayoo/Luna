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
    kind: 'wip' | 'link';
    tag: string;
    name: string;
    about: string | null;
    url: string;
};

/**
 * Pin one of your own WIP channels or links on Home, or edit/unpin one you pinned. Tag: OCS, a client company (People -> Companies), or
 * Custom (up to 4 letters or numbers). A WIP channel's link must be a WIP link; a link may be any web address. The server checks both
 * (WipTileRequest).
 */
export function WipTileDialog({
    tile,
    kind = tile?.kind ?? 'wip',
    tags = ['OCS', 'QSS'],
    trigger,
}: {
    /** Preset tags: OCS and the client companies' (People -> Companies). */
    tags?: string[];
    /** Omit to pin a new one. */
    tile?: WipTile;
    /** What a new tile is: a WIP channel (default) or any link. An edit keeps its tile's kind. */
    kind?: WipTile['kind'];
    trigger: ReactNode;
}) {
    const isLink = kind === 'link';
    const label = tile ? (isLink ? tile.name : `#${tile.name}`) : '';
    const [open, setOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);
    const initialCustom = tile && !tags.includes(tile.tag);
    const [custom, setCustom] = useState(Boolean(initialCustom));
    const form = useForm({
        kind,
        tag: tile?.tag ?? 'OCS',
        name: tile?.name ?? '',
        about: tile?.about ?? '',
        url: tile?.url ?? '',
    });
    const { data, setData, errors, processing } = form;
    const id = (f: string) => `wip-tile-${tile?.id ?? `new-${kind}`}-${f}`;

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
                        <DialogTitle>Unpin {label}?</DialogTitle>
                        <DialogDescription>
                            {isLink
                                ? 'It comes off your Home. The page itself isn’t touched.'
                                : 'It comes off your Home. The channel stays on WIP.'}
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
                            {tile
                                ? `Edit ${label}`
                                : isLink
                                  ? 'Pin a link'
                                  : 'Pin a WIP channel'}
                        </DialogTitle>
                        <DialogDescription>
                            {tile
                                ? `Only you see your pinned ${isLink ? 'links' : 'channels'}.`
                                : isLink
                                  ? 'Any page you open often: a board, a doc, a dashboard. It shows on your Home, under your channels. Only you see it.'
                                  : 'It shows on your Home, under the office channels. Only you see it.'}
                        </DialogDescription>

                        <form onSubmit={submit} className="grid gap-4">
                            <fieldset className="grid gap-2">
                                <legend className="mb-2 text-sm font-medium">
                                    Tag
                                </legend>
                                <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 sm:grid-cols-5">
                                    {[...tags, 'Custom'].map((t) => {
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
                                <Label htmlFor={id('name')}>
                                    {isLink ? 'Name' : 'Channel name'}
                                </Label>
                                <Input
                                    id={id('name')}
                                    required
                                    maxLength={40}
                                    autoComplete="off"
                                    placeholder={
                                        isLink
                                            ? 'e.g. Sprint board'
                                            : 'e.g. design-team'
                                    }
                                    className={isLink ? '' : 'font-mono'}
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
                                    placeholder={
                                        isLink
                                            ? 'e.g. This sprint’s tickets.'
                                            : 'e.g. Mockups and design reviews.'
                                    }
                                    value={data.about}
                                    onChange={(e) =>
                                        setData('about', e.target.value)
                                    }
                                />
                                <InputError message={errors.about} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={id('url')}>
                                    {isLink ? 'Link' : 'WIP link'}
                                </Label>
                                <Input
                                    id={id('url')}
                                    type="url"
                                    inputMode="url"
                                    required
                                    maxLength={500}
                                    autoComplete="off"
                                    placeholder={
                                        isLink
                                            ? 'https://…'
                                            : 'https://wip.quicksilversystems.com/…'
                                    }
                                    value={data.url}
                                    onChange={(e) =>
                                        setData('url', e.target.value)
                                    }
                                />
                                <p className="text-sm text-muted">
                                    {isLink
                                        ? 'Open the page and copy the address from the browser.'
                                        : 'In WIP, open the channel and copy the address from the browser.'}
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
