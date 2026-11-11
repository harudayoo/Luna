import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    name: string;
    email: string;
    passwordRules: string;
};

/** Reached from an invite link; posts back to the same signed URL. */
export default function AcceptInvite({ name, email, passwordRules }: Props) {
    return (
        <>
            <Head title="Set your password" />
            <p className="mb-6 text-sm">
                Hi {name}, choose a password to finish setting up your account.
            </p>

            <Form
                action={window.location.href}
                method="post"
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                autoComplete="username"
                                readOnly
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                autoFocus
                                required
                                passwordrules={passwordRules}
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">
                                Confirm password
                            </Label>
                            <PasswordInput
                                id="password_confirmation"
                                name="password_confirmation"
                                autoComplete="new-password"
                                required
                                passwordrules={passwordRules}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                        >
                            {processing && <Spinner />}
                            Set password and continue
                        </Button>
                    </div>
                )}
            </Form>
        </>
    );
}

AcceptInvite.layout = {
    title: 'Welcome to Luna',
    description: 'You were invited to the office app.',
};
