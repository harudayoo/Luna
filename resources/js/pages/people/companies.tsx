import { Form, Head, router } from '@inertiajs/react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import CompanyController from '@/actions/App/Http/Controllers/CompanyController';
import InputError from '@/components/input-error';
import { PeopleTabs } from '@/components/people-tabs';
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
import { companies as companiesRoute } from '@/routes/people';

type Channel = { id: number; name: string; url: string };
type Company = { id: number; tag: string; name: string; channels: Channel[] };

/**
 * People -> Companies (admin): the client companies and their WIP item boards. Items pick a board so logged
 * time goes to the right place; the tags are also the WIP tile tags on Home.
 */
export default function Companies({ companies }: { companies: Company[] }) {
    return (
        <>
            <Head title="Companies" />
            <PeopleTabs />

            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="ocs-eyebrow">People</p>
                    <h2 className="text-2xl font-semibold">Companies</h2>
                    <p className="mt-1 text-sm text-muted">
                        Clients and their WIP item boards. Items log time to
                        these.
                    </p>
                </div>
                <CompanyDialog
                    trigger={
                        <Button className="min-h-11">
                            <Plus /> Add company
                        </Button>
                    }
                />
            </div>

            {companies.length === 0 ? (
                <p className="bg-surface p-4 text-sm text-muted">
                    No companies yet.
                </p>
            ) : (
                <ul className="ocs-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {companies.map((c) => (
                        <li key={c.id} className="ocs-card min-w-0">
                            <div className="mb-3 flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="ocs-eyebrow mb-1 font-mono">
                                        {c.tag}
                                    </p>
                                    <p className="truncate font-semibold">
                                        {c.name}
                                    </p>
                                </div>
                                <CompanyDialog
                                    company={c}
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-10"
                                            aria-label={`Edit ${c.tag}`}
                                        >
                                            <Pencil />
                                        </Button>
                                    }
                                />
                                <Remove
                                    label={`Remove ${c.tag}?`}
                                    about="Its channels go with it. Items on them stay, without a channel."
                                    url={CompanyController.destroy.url(c.id)}
                                />
                            </div>
                            <ul className="mb-3 grid gap-1">
                                {c.channels.map((ch) => (
                                    <li
                                        key={ch.id}
                                        className="flex min-h-11 items-center gap-1 bg-bg pl-3"
                                    >
                                        <a
                                            href={ch.url}
                                            target="_blank"
                                            rel="noopener"
                                            className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold hover:text-primary"
                                        >
                                            <span className="truncate">
                                                {ch.name}
                                            </span>
                                            <ExternalLink className="size-3.5 shrink-0 text-muted" />
                                        </a>
                                        <ChannelDialog
                                            companyId={c.id}
                                            channel={ch}
                                            trigger={
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-10"
                                                    aria-label={`Edit ${c.tag} ${ch.name}`}
                                                >
                                                    <Pencil />
                                                </Button>
                                            }
                                        />
                                        <Remove
                                            label={`Remove ${c.tag} · ${ch.name}?`}
                                            about="Items on it stay, without a channel."
                                            url={CompanyController.destroyChannel.url(
                                                ch.id,
                                            )}
                                        />
                                    </li>
                                ))}
                            </ul>
                            <ChannelDialog
                                companyId={c.id}
                                trigger={
                                    <Button
                                        variant="secondary"
                                        className="min-h-10 bg-bg"
                                    >
                                        <Plus /> Add channel
                                    </Button>
                                }
                            />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

function CompanyDialog({
    company,
    trigger,
}: {
    company?: Company;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const key = company?.id ?? 'new';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>
                    {company ? `Edit ${company.tag}` : 'Add a company'}
                </DialogTitle>
                <DialogDescription>
                    The tag is how the office names it (up to 4 letters or
                    numbers). It's also a WIP tile tag on Home.
                </DialogDescription>
                <Form
                    {...(company
                        ? CompanyController.update.form(company.id)
                        : CompanyController.store.form())}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    resetOnSuccess
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`tag-${key}`}>Tag</Label>
                                <Input
                                    id={`tag-${key}`}
                                    name="tag"
                                    maxLength={4}
                                    autoComplete="off"
                                    defaultValue={company?.tag}
                                    placeholder="e.g. SSI"
                                    className="font-mono uppercase"
                                    required
                                />
                                <InputError message={errors.tag} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`name-${key}`}>Name</Label>
                                <Input
                                    id={`name-${key}`}
                                    name="name"
                                    maxLength={80}
                                    autoComplete="off"
                                    defaultValue={company?.name}
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>
                            <Button className="min-h-11" disabled={processing}>
                                {processing && <Spinner />}
                                {company ? 'Save' : 'Add company'}
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ChannelDialog({
    companyId,
    channel,
    trigger,
}: {
    companyId: number;
    channel?: Channel;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const key = channel?.id ?? `new-${companyId}`;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>
                    {channel ? `Edit ${channel.name}` : 'Add an item channel'}
                </DialogTitle>
                <DialogDescription>
                    Paste the WIP board link (the channel opened in Board view).
                </DialogDescription>
                <Form
                    {...(channel
                        ? CompanyController.updateChannel.form(channel.id)
                        : CompanyController.storeChannel.form(companyId))}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    resetOnSuccess
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`ch-name-${key}`}>Name</Label>
                                <Input
                                    id={`ch-name-${key}`}
                                    name="name"
                                    maxLength={60}
                                    autoComplete="off"
                                    defaultValue={channel?.name}
                                    placeholder="e.g. Items, Changes"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`ch-url-${key}`}>
                                    WIP link
                                </Label>
                                <Input
                                    id={`ch-url-${key}`}
                                    name="url"
                                    type="url"
                                    inputMode="url"
                                    autoComplete="off"
                                    defaultValue={channel?.url}
                                    placeholder="https://wip.quicksilversystems.com/servers/…"
                                    required
                                />
                                <InputError message={errors.url} />
                            </div>
                            <Button className="min-h-11" disabled={processing}>
                                {processing && <Spinner />}
                                {channel ? 'Save' : 'Add channel'}
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function Remove({
    label,
    about,
    url,
}: {
    label: string;
    about: string;
    url: string;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={label.replace('?', '')}
                >
                    <Trash2 />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{label}</DialogTitle>
                <DialogDescription>{about}</DialogDescription>
                <Button
                    variant="destructive"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() =>
                        router.delete(url, {
                            preserveScroll: true,
                            onStart: () => setBusy(true),
                            onFinish: () => setBusy(false),
                            onSuccess: () => setOpen(false),
                        })
                    }
                >
                    {busy && <Spinner />} Remove
                </Button>
            </DialogContent>
        </Dialog>
    );
}

Companies.layout = {
    breadcrumbs: [{ title: 'Companies', href: companiesRoute() }],
};
