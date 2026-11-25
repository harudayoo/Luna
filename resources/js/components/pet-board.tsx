import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import { PetSprite } from '@/components/pet-sprite';
import { Button } from '@/components/ui/button';
import type { Pet, PetBoardData } from '@/lib/pet';

/**
 * The office board (spec 2026-11-25-luna-pet-social, slice 2): pets of people who chose to show theirs, ranked by
 * stage, then streak. No XP and no last place. Joining is a switch here; the board loads when the tab opens.
 */
export function PetBoard({ pet }: { pet: Pet }) {
    const { pet_board: board } = usePage<{ pet_board?: PetBoardData }>().props;
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        router.reload({ only: ['pet_board'] });
    }, []);

    const setJoined = (joined: boolean) =>
        router.patch(
            PetController.update(),
            { public: joined },
            {
                preserveScroll: true,
                only: ['pet', 'pet_board'],
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
            },
        );

    const rows = board?.rows ?? [];
    const top = rows.filter((r) => r.rank <= 10);
    const mine = rows.find((r) => r.rank > 10);

    return (
        <section aria-label="Office board" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bg px-4 py-3">
                <p className="min-w-0 flex-1 text-sm">
                    {pet.public
                        ? 'Your pet is on the board.'
                        : 'Show your pet here to join in. Only its stage and streak are shown, never XP.'}
                </p>
                <Button
                    variant={pet.public ? 'secondary' : 'default'}
                    size="sm"
                    disabled={saving}
                    onClick={() => setJoined(!pet.public)}
                >
                    {pet.public ? 'Leave the board' : 'Join the board'}
                </Button>
            </div>

            {!board ? (
                <p className="text-sm text-muted">Loading&hellip;</p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted">
                    Nobody&rsquo;s on the board yet. Be the first.
                </p>
            ) : (
                <ol className="grid gap-1">
                    {top.map((r) => (
                        <Row key={r.rank} row={r} />
                    ))}
                    {mine && (
                        <>
                            <li aria-hidden className="text-center text-muted">
                                &hellip;
                            </li>
                            <Row row={mine} />
                        </>
                    )}
                </ol>
            )}
            <p className="text-xs text-muted">
                Ranked by stage, then streak. Only people who joined are shown.
            </p>
        </section>
    );
}

function Row({ row }: { row: PetBoardData['rows'][number] }) {
    return (
        <li
            aria-current={row.me ? 'true' : undefined}
            className={`flex items-center gap-3 px-3 py-2 ${row.me ? 'bg-surface-hover' : 'bg-bg'}`}
        >
            <span className="w-6 shrink-0 text-right font-mono text-sm text-muted">
                {row.rank}
            </span>
            <PetSprite
                stage={row.stage}
                title={row.stage_name}
                className="size-10"
            />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                    {row.pet_name ?? `${row.first_name}’s moonling`}
                </span>
                <span className="block truncate text-xs text-muted">
                    {row.pet_name ? `${row.first_name} · ` : ''}
                    {row.stage_name}
                    {row.me ? ' · you' : ''}
                </span>
            </span>
            {row.streak > 1 && (
                <span
                    className="shrink-0 text-xs text-muted"
                    title={`${row.streak}-day streak`}
                >
                    🔥 {row.streak}
                </span>
            )}
        </li>
    );
}
