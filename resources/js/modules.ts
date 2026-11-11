/*
 * Luna's feature modules: the one list the Bloom dock is drawn from.
 *
 * Adding a feature (full recipe: vault note "Luna/Modules and the Bloom dock"):
 *   1. routes/modules/<module>.php   its routes, with their own middleware/gates
 *   2. app/Http/Controllers/<Module>Controller.php
 *   3. resources/js/pages/<module>/  its pages
 *   4. one entry below               order = position in the dock
 * The dock shows up to DOCK_SLOTS tiles; past that, the last slot becomes "More". `gate` only hides
 * the tile; the routes enforce access on their own.
 */
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, CalendarRange, House, Users } from 'lucide-react';
import { dashboard } from '@/routes';
import { index as calendar } from '@/routes/calendar';
import { index as leave } from '@/routes/leave';
import { index as people } from '@/routes/people';

export type Module = {
    key: string;
    title: string;
    icon: LucideIcon;
    href: NonNullable<InertiaLinkProps['href']>;
    /** URL prefix the module owns; the bloom sits on it for any page under it. */
    match: string;
    /** Lowest role that sees it; omit for everyone. */
    gate?: 'hr' | 'admin';
};

export const MODULES: Module[] = [
    {
        key: 'home',
        title: 'Home',
        icon: House,
        href: dashboard(),
        match: '/dashboard',
    },
    {
        key: 'leave',
        title: 'Leave',
        icon: CalendarDays,
        href: leave(),
        match: '/leave',
    },
    {
        key: 'calendar',
        title: 'Calendar',
        icon: CalendarRange,
        href: calendar(),
        match: '/calendar',
    },
    {
        key: 'people',
        title: 'People',
        icon: Users,
        href: people(),
        match: '/people',
        gate: 'hr',
    },
];

/** Tiles before "More" takes over the last slot. */
export const DOCK_SLOTS = 5;
