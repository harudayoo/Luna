import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    compact = false,
}: {
    user: User;
    showEmail?: boolean;
    /** Top bar: the name only shows from sm up. */
    compact?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="size-8 overflow-hidden rounded-none">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-none bg-primary text-on-primary">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div
                className={
                    compact
                        ? 'hidden text-left text-sm leading-tight sm:grid'
                        : 'grid flex-1 text-left text-sm leading-tight'
                }
            >
                <span className="truncate font-medium">{user.name}</span>
                {showEmail && (
                    <span className="truncate text-xs text-muted">
                        {user.email}
                    </span>
                )}
            </div>
        </>
    );
}
