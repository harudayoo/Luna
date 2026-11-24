import { Link, router, usePage, usePoll } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    CalendarDays,
    CalendarRange,
    Clock,
    ReceiptText,
    UserPlus,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { badgeLabel, freshSince } from '@/lib/notifications';
import type { Notifications } from '@/lib/notifications';
import { ringBell } from '@/lib/ocs';
import { open, readAll } from '@/routes/notifications';

const ICONS: Record<string, LucideIcon> = {
    payslip_released: ReceiptText,
    pay_schedule: ReceiptText,
    payslips_due: ReceiptText,
    holiday: CalendarRange,
    leave_for_you: CalendarDays,
    leave_unpaid: CalendarDays,
    leave_logged: CalendarDays,
    leave_unpaid_hr: CalendarDays,
    late_declared: Clock,
    joined: UserPlus,
};

const POLL_MS = 60_000;

/*
 * The bell in the top bar. A poll reloads only the `notifications` prop every minute; anything new
 * gets a toast and the bell rings (lib/ocs.ts ringBell: a paper wobble by day, a glowing sway by night).
 */
export function NotificationBell() {
    const notifications = usePage().props.notifications as Notifications | null;
    const trigger = useRef<HTMLButtonElement>(null);
    const seen = useRef<Set<string> | null>(null);

    usePoll(POLL_MS, { only: ['notifications'] });

    useEffect(() => {
        if (!notifications) {
            return;
        }
        // First render: what's already there isn't news.
        if (seen.current === null) {
            seen.current = new Set(notifications.items.map((n) => n.id));

            return;
        }
        const fresh = freshSince(notifications.items, seen.current);
        notifications.items.forEach((n) => seen.current?.add(n.id));
        if (fresh.length === 0) {
            return;
        }
        const [first] = fresh;
        toast(first.title, {
            description:
                fresh.length > 1
                    ? `${first.body} (+${fresh.length - 1} more)`
                    : first.body,
            action: {
                label: 'Open',
                onClick: () => router.visit(open(first.id)),
            },
        });
        if (trigger.current) {
            ringBell(trigger.current);
        }
    }, [notifications]);

    if (!notifications) {
        return null;
    }
    const { unread, items } = notifications;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                ref={trigger}
                className="relative flex size-10 items-center justify-center text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                aria-label={
                    unread > 0
                        ? `Notifications, ${unread} unread`
                        : 'Notifications'
                }
            >
                <Bell data-bell-icon aria-hidden="true" className="size-5" />
                {unread > 0 && (
                    <span
                        data-bell-badge
                        aria-hidden="true"
                        className="absolute top-1 right-0.5 h-[18px] min-w-[18px] rounded-sm bg-primary px-1 text-center font-mono text-[10px] leading-[18px] font-semibold text-on-primary"
                    >
                        {badgeLabel(unread)}
                    </span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[calc(100vw-1rem)] max-w-96 p-0"
            >
                <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                    <p className="ocs-eyebrow">Notifications</p>
                    {unread > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            // On the surface panel the secondary shade would vanish: use the page
                            // shade, as People does for buttons inside panels.
                            className="bg-bg"
                            onClick={() =>
                                router.post(
                                    readAll(),
                                    {},
                                    {
                                        preserveScroll: true,
                                        only: ['notifications'],
                                    },
                                )
                            }
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                {items.length === 0 ? (
                    <p className="px-4 pb-5 text-sm text-muted">
                        You&rsquo;re all caught up.
                    </p>
                ) : (
                    <ul className="max-h-[70dvh] overflow-y-auto pb-1">
                        {items.map((n) => {
                            const Icon = ICONS[n.kind] ?? Bell;

                            return (
                                <li key={n.id}>
                                    <DropdownMenuItem
                                        asChild
                                        className="min-h-10 items-start gap-3 rounded-none px-4 py-3"
                                    >
                                        <Link
                                            href={open(n.id)}
                                            className={
                                                n.read ? '' : 'bg-surface-hover'
                                            }
                                        >
                                            <Icon
                                                aria-hidden="true"
                                                className="mt-0.5 size-4 text-primary"
                                            />
                                            <span className="grid min-w-0 flex-1 gap-0.5">
                                                <span
                                                    className={`text-sm ${n.read ? 'text-muted' : 'font-semibold text-ink'}`}
                                                >
                                                    {n.title}
                                                </span>
                                                <span className="text-xs text-muted">
                                                    {n.body}
                                                </span>
                                                <span className="font-mono text-[11px] text-muted">
                                                    {n.ago}
                                                </span>
                                            </span>
                                            {!n.read && (
                                                <span
                                                    aria-label="Unread"
                                                    className="mt-1.5 size-2 shrink-0 bg-primary"
                                                />
                                            )}
                                        </Link>
                                    </DropdownMenuItem>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
