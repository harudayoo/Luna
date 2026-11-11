export type User = {
    id: number;
    name: string;
    email: string;
    role: Role;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

/** employee < hr < admin; each includes the ones below it (App\Enums\Role). */
export type Role = 'employee' | 'hr' | 'admin';

export type Auth = {
    user: User;
    /** Mirrors the server gates, for showing UI only; the routes enforce them. */
    can: { hr: boolean; admin: boolean };
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
