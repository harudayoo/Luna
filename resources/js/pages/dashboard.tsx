import { Head, usePage } from '@inertiajs/react';
import type { GlanceItem } from '@/components/glance';
import { GLANCE_ICONS, GlanceRail, GlanceStrip } from '@/components/glance';
import { PetCard } from '@/components/pet-card';
import type { Today } from '@/components/time-today';
import { TimeToday } from '@/components/time-today';
import type { WipChannel } from '@/components/wip-channels';
import { WipChannels } from '@/components/wip-channels';
import type { WipTile } from '@/components/wip-tile-dialog';
import type { Pet, PetMoment } from '@/lib/pet';
import { dashboard } from '@/routes';
import { index as analyticsIndex } from '@/routes/analytics';
import { index as calendarIndex } from '@/routes/calendar';
import { index as leaveIndex } from '@/routes/leave';
import { index as payslipsIndex } from '@/routes/payslips';

type Props = {
    pto: {
        balance_hours: number;
        hours_per_day: number;
        next_payday: string | null;
        next_accrual: number | null;
    };
    out_today: number;
    today: Today;
    wip: WipChannel[];
    my_wip: WipTile[];
    my_links: WipTile[];
    wip_tags: string[];
    wip_max: number;
    pet: Pet;
    pet_moment: PetMoment;
};

const short = (iso: string) =>
    new Intl.DateTimeFormat('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));

export default function Dashboard({
    pto,
    out_today,
    today,
    wip,
    my_wip,
    my_links,
    wip_tags,
    wip_max,
    pet,
    pet_moment,
}: Props) {
    const { auth } = usePage().props;
    const attendance = wip.find((c) => c.key === 'attendance')?.url ?? '';

    const glance: GlanceItem[] = [
        {
            key: 'leave',
            eyebrow: 'Leave',
            title: `${pto.balance_hours.toFixed(2)} h PTO`,
            note:
                `${(pto.balance_hours / pto.hours_per_day).toFixed(2)} days` +
                (pto.next_payday && pto.next_accrual !== null
                    ? ` · +${pto.next_accrual.toFixed(2)} h ${short(pto.next_payday)}`
                    : ''),
            href: leaveIndex(),
            icon: GLANCE_ICONS.leave,
        },
        {
            key: 'calendar',
            eyebrow: 'Calendar',
            title: out_today === 0 ? 'Everyone’s in' : `${out_today} out today`,
            note: 'Leave and office holidays',
            href: calendarIndex(),
            icon: GLANCE_ICONS.calendar,
        },
        {
            key: 'analytics',
            eyebrow: 'Analytics',
            title: 'Your year',
            note: 'PTO and pay by cut-off',
            href: analyticsIndex(),
            icon: GLANCE_ICONS.analytics,
        },
        // Everyone's own payslips; employees see them once HR releases their pay.
        {
            key: 'pay',
            eyebrow: 'Pay',
            title: 'My payslips',
            note: auth.can.hr ? 'Ready to print' : 'Once your pay is released',
            href: payslipsIndex(),
            icon: GLANCE_ICONS.pay,
        },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <p className="ocs-eyebrow">Luna</p>
            <h2 className="mb-6 text-2xl font-semibold">
                Hello, {auth.user.name.split(' ')[0]}
            </h2>
            {/* Gist first: on phones the glance strip leads; on desktop it's a rail beside Time and WIP. */}
            <GlanceStrip items={glance} />
            <div className="grid gap-x-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
                <div className="min-w-0">
                    <div className="mb-8">
                        <TimeToday today={today} wipUrl={attendance} />
                    </div>
                    <WipChannels
                        channels={wip}
                        mine={my_wip}
                        links={my_links}
                        max={wip_max}
                        tags={wip_tags}
                    />
                </div>
                {/* On phones the aside follows WIP, so the pet comes after the gist. */}
                <aside className="mt-8 lg:mt-0">
                    {/* The rail is sticky itself: its own box keeps it from sliding over the pet. */}
                    <div className="flex flex-col gap-3 lg:sticky lg:top-20">
                        <div>
                            <GlanceRail items={glance} />
                        </div>
                        <PetCard pet={pet} moment={pet_moment} />
                    </div>
                </aside>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
