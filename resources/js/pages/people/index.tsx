import { Form, Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import PeopleController from '@/actions/App/Http/Controllers/PeopleController';
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
    invite_url: string | null;
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
                        className="flex flex-col gap-3 bg-surface p-4 sm:flex-row sm:items-center"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                                {person.name}
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
                                {person.daily_rate !== null
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
                            <div className="flex items-center gap-3">
                                <span className="ocs-badge">invited</span>
                                <CopyInviteLink url={person.invite_url} />
                            </div>
                        )}

                        {auth.can.admin ? (
                            <RoleSelect person={person} roles={roles} />
                        ) : (
                            <span className="ocs-badge sm:w-36 sm:text-center">
                                {label(person.role)}
                            </span>
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
                                <Label htmlFor={`rate-${person.id}`}>
                                    Daily rate (₱)
                                </Label>
                                <Input
                                    id={`rate-${person.id}`}
                                    name="daily_rate"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0"
                                    defaultValue={person.daily_rate ?? ''}
                                    placeholder="e.g. 1800"
                                />
                                <InputError message={errors.daily_rate} />
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

function CopyInviteLink({ url }: { url: string }) {
    const [, copy] = useClipboard();

    return (
        <Button
            variant="code"
            size="sm"
            onClick={() =>
                void copy(url).then((ok) =>
                    ok
                        ? toast.success('Invite link copied.')
                        : toast.error("Couldn't copy the link."),
                )
            }
        >
            Copy invite link
        </Button>
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
