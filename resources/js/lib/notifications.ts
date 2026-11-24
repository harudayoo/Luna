/*
 * The bell's data and pure helpers (components/notification-bell.tsx), kept apart from the component
 * so they can be tested without a browser.
 */

export type Notice = {
    id: string;
    kind: string;
    title: string;
    body: string;
    module: string | null;
    read: boolean;
    ago: string;
};

/** The shared `notifications` prop (HandleInertiaRequests): the bell and the dock's dots. */
export type Notifications = {
    unread: number;
    items: Notice[];
    /** Unread count per modules.ts key, for the dock. */
    modules: Record<string, number>;
};

/** Unread notices not seen before, newest first (ids are UUIDs, so "seen" is a set, not a max). */
export function freshSince(items: Notice[], seen: Set<string>): Notice[] {
    return items.filter((n) => !n.read && !seen.has(n.id));
}

/** The badge text: the count, capped at 9+ so it stays a tiny square. */
export function badgeLabel(unread: number): string {
    return unread > 9 ? '9+' : String(unread);
}
