import { Form, Head, router, usePage } from '@inertiajs/react';
import { UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import PeopleController from '@/actions/App/Http/Controllers/PeopleController';
import InputError from '@/components/input-error';
import { PeopleTabs } from '@/components/people-tabs';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { index as peopleIndex } from '@/routes/people';
import type { Role } from '@/types';

type Person = {
    id: number;
    name: string;
    email: string;
    role: Role;
    invited: boolean;
    /** An admin ended their access; history stays. */
    deactivated: boolean;
    invite_url: string | null;
    position: string | null;
    monthly_salary: number | null;
    daily_rate: number | null;
    pto_start: string | null;
    pto_opening_hours: number;
};

type Props = {
    people: Person[];
    officeStartedOn: string;
    roles: { value: Role; label: string }[];
    invitableRoles: Role[];
};

export default function People({
    people,
    roles,
    invitableRoles,
    officeStartedOn,
}: Props) {
    const { auth } = usePage().props;
    const label = (role: Role) => roles.find((r) => r.value === role)?.label;

    return (
        <>
            <Head title="People" />
            <p className="ocs-eyebrow">People</p>
            <h2 className="mb-4 text-2xl font-semibold">People</h2>
            <PeopleTabs />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <p className="max-w-prose text-sm text-muted">
                    Everyone with a Luna account. Invited people set their own
                    password from their link. Set each person&rsquo;s daily rate
                    so unpaid leave shows in pesos.
                </p>
                <InviteDialog roles={roles} invitableRoles={invitableRoles} />
            </div>

            <ul className="grid gap-2">
                {people.map((person) => (
                    <li
                        key={person.id}
                        className="flex flex-col gap-3 bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center"
                    >
                        <div className="min-w-0 flex-1 sm:min-w-60">
                            <p
                                className={`truncate font-semibold ${person.deactivated ? 'text-muted' : ''}`}
                            >
                                {person.name}
                                {person.deactivated && (
                                    <span className="ocs-badge ml-2">
                                        deactivated
                                    </span>
                                )}
                                {person.id === auth.user.id && (
                                    <span className="ml-2 text-xs font-normal text-muted">
                                        (you)
                                    </span>
                                )}
                            </p>
                            <p className="truncate text-sm text-muted">
                                {person.email}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                                {person.position && `${person.position} · `}
                                {person.monthly_salary !== null
                                    ? `${peso(person.monthly_salary)}/month`
                                    : person.daily_rate !== null
                                      ? `${peso(person.daily_rate)}/day`
                                      : 'No daily rate'}
                                {' · from '}
                                {shortDate(person.pto_start ?? officeStartedOn)}
                                {person.pto_opening_hours > 0 &&
                                    ` · opening ${person.pto_opening_hours.toFixed(2)} h`}
                            </p>
                        </div>

                        <LeaveDetails
                            person={person}
                            officeStartedOn={officeStartedOn}
                        />

                        {person.invite_url && (
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="ocs-badge">invited</span>
                                <CopyInviteLink url={person.invite_url} />
                                <ResendInvite person={person} />
                            </div>
                        )}

                        {auth.can.admin ? (
                            <RoleSelect person={person} roles={roles} />
                        ) : (
                            <span className="ocs-badge sm:w-36 sm:text-center">
                                {label(person.role)}
                            </span>
                        )}

                        {auth.can.admin && person.id !== auth.user.id && (
                            <AccountAccess person={person} />
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}

const peso = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(n);
const shortDate = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

/** HR sets the PTO values the engine needs: rate (for pesos), start date, opening balance. */
function LeaveDetails({
    person,
    officeStartedOn,
}: {
    person: Person;
    officeStartedOn: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {/* On a surface row the secondary shade would vanish: use the page
                    shade, as the kit does for secondary buttons inside panels. */}
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full bg-bg sm:w-auto"
                >
                    Leave details
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogTitle>{person.name}&rsquo;s leave details</DialogTitle>
                <DialogDescription>
                    Used for their PTO balance and to show unpaid leave in
                    pesos.
                </DialogDescription>
                <Form
                    {...PeopleController.update.form(person.id)}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor={`position-${person.id}`}>
                                    Position
                                </Label>
                                <Input
                                    id={`position-${person.id}`}
                                    name="position"
                                    maxLength={80}
                                    autoComplete="organization-title"
                                    defaultValue={person.position ?? ''}
                                    placeholder="e.g. Software Developer"
                                />
                                <InputError message={errors.position} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`salary-${person.id}`}>
                                    Monthly salary (₱)
                                </Label>
                                <Input
                                    id={`salary-${person.id}`}
                                    name="monthly_salary"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0"
                                    defaultValue={
                                        person.monthly_salary ??
                                        (person.daily_rate !== null
                                            ? Math.round(person.daily_rate * 22)
                                            : '')
                                    }
                                    placeholder="e.g. 60000"
                                />
                                <p className="text-xs text-muted">
                                    The daily rate for unpaid leave is this ÷ 22
                                    {person.daily_rate !== null &&
                                        ` (now ${peso(person.daily_rate)})`}
                                    .
                                </p>
                                <InputError message={errors.monthly_salary} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`start-${person.id}`}>
                                    PTO starts on
                                </Label>
                                <Input
                                    id={`start-${person.id}`}
                                    name="pto_start"
                                    type="date"
                                    min={officeStartedOn}
                                    defaultValue={person.pto_start ?? ''}
                                />
                                <p className="text-xs text-muted">
                                    Leave empty if they started when the office
                                    opened ({shortDate(officeStartedOn)}).
                                </p>
                                <InputError message={errors.pto_start} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`opening-${person.id}`}>
                                    Opening balance (hours)
                                </Label>
                                <Input
                                    id={`opening-${person.id}`}
                                    name="pto_opening_hours"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0"
                                    defaultValue={person.pto_opening_hours}
                                    required
                                />
                                <p className="text-xs text-muted">
                                    PTO they already had on their start date.
                                    Usually 0.
                                </p>
                                <InputError
                                    message={errors.pto_opening_hours}
                                />
                            </div>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Save
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Copies the set-password link; if the browser won't copy, shows it to copy by hand. */
function CopyInviteLink({ url }: { url: string }) {
    const [, copy] = useClipboard();
    const [manual, setManual] = useState(false);

    return (
        <>
            <Button
                variant="code"
                size="sm"
                onClick={() =>
                    void copy(url).then((ok) =>
                        ok
                            ? toast.success(
                                  'Invite link copied. Paste it to them in chat.',
                              )
                            : setManual(true),
                    )
                }
            >
                Copy invite link
            </Button>
            <Dialog open={manual} onOpenChange={setManual}>
                <DialogContent>
                    <DialogTitle>Copy the invite link</DialogTitle>
                    <DialogDescription>
                        This browser won’t copy it automatically. The link is
                        selected: press Ctrl+C (or long-press on a phone), then
                        send it to them.
                    </DialogDescription>
                    <Input
                        readOnly
                        value={url}
                        autoFocus
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label="Invite link"
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Done</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Emails a pending invite again, with a fresh 7-day link. */
function ResendInvite({ person }: { person: Person }) {
    const [busy, setBusy] = useState(false);

    return (
        <Button
            variant="ghost"
            size="sm"
            className="min-h-10"
            disabled={busy}
            onClick={() =>
                router.post(
                    PeopleController.resendInvite(person.id).url,
                    {},
                    {
                        preserveScroll: true,
                        onStart: () => setBusy(true),
                        onFinish: () => setBusy(false),
                        onError: (errors) =>
                            errors.invite && toast.error(errors.invite),
                    },
                )
            }
        >
            {busy && <Spinner />}
            Resend
        </Button>
    );
}

/**
 * Admin only: end or restore someone's access. Deactivating asks first; their leave and payroll
 * history stay either way. The server refuses yourself and the last active admin, and says why.
 */
function AccountAccess({ person }: { person: Person }) {
    const [busy, setBusy] = useState(false);
    const options = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
        onError: (errors: Record<string, string>) =>
            errors.account && toast.error(errors.account),
    };

    if (person.deactivated) {
        return (
            <Button
                variant="secondary"
                size="sm"
                className="w-full bg-bg sm:w-auto"
                disabled={busy}
                onClick={() =>
                    router.patch(
                        PeopleController.reactivate(person.id).url,
                        {},
                        options,
                    )
                }
            >
                {busy && <Spinner />}
                Reactivate
            </Button>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10 w-full sm:w-auto"
                    aria-label={`Deactivate ${person.name}`}
                >
                    <UserX /> Deactivate
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Deactivate {person.name}?</DialogTitle>
                <DialogDescription>
                    They&rsquo;re signed out and can&rsquo;t sign in again until
                    you reactivate them. Their leave and payroll history stay.
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Keep access</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                            router.patch(
                                PeopleController.deactivate(person.id).url,
                                {},
                                options,
                            )
                        }
                    >
                        {busy && <Spinner />}
                        Deactivate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Admin only. The server refuses to remove the last admin and says why. */
function RoleSelect({
    person,
    roles,
}: {
    person: Person;
    roles: Props['roles'];
}) {
    return (
        <Select
            value={person.role}
            onValueChange={(role) =>
                router.patch(
                    PeopleController.updateRole(person.id).url,
                    { role },
                    {
                        preserveScroll: true,
                        onError: (errors) =>
                            errors.role && toast.error(errors.role),
                    },
                )
            }
        >
            <SelectTrigger
                className="w-full sm:w-36"
                aria-label={`Role for ${person.name}`}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                        {r.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function InviteDialog({
    roles,
    invitableRoles,
}: Pick<Props, 'roles' | 'invitableRoles'>) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Invite someone</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Invite someone</DialogTitle>
                <DialogDescription>
                    They get an email with a link to set their password. The
                    link works for 7 days; you can also copy it from the list.
                </DialogDescription>

                <Form
                    {...PeopleController.store.form()}
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    autoFocus
                                />
                                <InputError message={errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="name@orchidcity.example"
                                />
                                <InputError message={errors.email} />
                            </div>
                            {invitableRoles.length > 1 ? (
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Role</Label>
                                    <Select name="role" defaultValue="employee">
                                        <SelectTrigger id="role">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles
                                                .filter((r) =>
                                                    invitableRoles.includes(
                                                        r.value,
                                                    ),
                                                )
                                                .map((r) => (
                                                    <SelectItem
                                                        key={r.value}
                                                        value={r.value}
                                                    >
                                                        {r.label}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.role} />
                                </div>
                            ) : (
                                <input
                                    type="hidden"
                                    name="role"
                                    value="employee"
                                />
                            )}
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Send invite
                            </Button>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

People.layout = {
    breadcrumbs: [{ title: 'People', href: peopleIndex() }],
};
