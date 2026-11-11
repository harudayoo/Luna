import { Form, Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import PeopleController from '@/actions/App/Http/Controllers/PeopleController';
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
};

type Props = {
    people: Person[];
    roles: { value: Role; label: string }[];
    invitableRoles: Role[];
};

export default function People({ people, roles, invitableRoles }: Props) {
    const { auth } = usePage().props;
    const label = (role: Role) => roles.find((r) => r.value === role)?.label;

    return (
        <>
            <Head title="People" />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="ocs-eyebrow">Accounts</p>
                    <h2 className="text-2xl font-semibold">People</h2>
                    <p className="text-sm text-muted">
                        Everyone with a Luna account. Invited people set their
                        own password from their link.
                    </p>
                </div>
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
                        </div>

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

function InviteDialog({ roles, invitableRoles }: Omit<Props, 'people'>) {
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
