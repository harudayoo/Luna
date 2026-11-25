import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import PetController from '@/actions/App/Http/Controllers/PetController';
import PetDuelController from '@/actions/App/Http/Controllers/PetDuelController';
import InputError from '@/components/input-error';
import { PetSprite } from '@/components/pet-sprite';
import { Button } from '@/components/ui/button';
import type { DuelPick, Pet, PetBoardData, PetDuelsData } from '@/lib/pet';
import { canChallenge, cupRecord, DUEL_PICKS } from '@/lib/pet';

type Row = PetBoardData['rows'][number];
type CupRow = PetBoardData['cup'][number];

/**
 * The office board (spec 2026-11-25-luna-pet-social, slices 2–4): pets of people who chose to show theirs, ranked
 * by stage, then streak. No XP and no last place. Joining is a switch here; from a row you can send a moon duel.
 * The Moon Cup view ranks this week's duel wins; last week's champion wears a crown everywhere.
 * The board and your duels load when the tab opens.
 */
export function PetBoard({ pet }: { pet: Pet }) {
    const {
        pet_board: board,
        pet_duels: duels,
        errors,
    } = usePage<{
        pet_board?: PetBoardData;
        pet_duels?: PetDuelsData;
        errors: Record<string, string>;
    }>().props;
    const [saving, setSaving] = useState(false);
    const [picking, setPicking] = useState<number | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [view, setView] = useState<'stage' | 'cup'>('stage');

    const setJoined = (joined: boolean) =>
        router.patch(
            PetController.update(),
            { public: joined },
            {
                preserveScroll: true,
                only: ['pet', 'pet_board', 'pet_duels'],
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
            },
        );

    const challenge = (row: Row, pick: DuelPick) =>
        router.post(
            PetDuelController.store(),
            { opponent_id: row.user_id, pick },
            {
                preserveScroll: true,
                only: ['pet_duels', 'errors'],
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    setPicking(null);
                    setSentTo(row.first_name);
                },
            },
        );

    const rows = board?.rows ?? [];
    const top = rows.filter((r) => r.rank <= 10);
    const mine = rows.find((r) => r.rank > 10);
    const row = (r: Row) => (
        <BoardRow
            key={r.rank}
            row={r}
            can={canChallenge(r, duels, pet.public)}
            picking={picking === r.user_id}
            saving={saving}
            onChallenge={() =>
                setPicking(picking === r.user_id ? null : r.user_id)
            }
            onPick={(p) => challenge(r, p)}
        />
    );

    return (
        <section aria-label="Office board" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bg px-4 py-3">
                <p className="min-w-0 flex-1 text-sm">
                    {pet.public
                        ? 'Your pet is on the board. Challenge someone to a moon duel.'
                        : 'Show your pet here to join in and duel. Only its stage and streak are shown, never XP.'}
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

            {sentTo && (
                <p role="status" className="bg-surface-hover px-4 py-2 text-sm">
                    Challenge sent. {sentTo} answers next time they open Luna.
                </p>
            )}
            <InputError message={errors.opponent_id} />

            <div
                role="radiogroup"
                aria-label="Rank by"
                className="grid grid-cols-2 gap-1 bg-bg p-1"
            >
                {(
                    [
                        ['stage', 'Stage & streak'],
                        ['cup', 'Moon Cup'],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={view === key}
                        onClick={() => setView(key)}
                        className="min-h-10 px-3 text-sm font-semibold text-muted aria-checked:bg-surface-hover aria-checked:text-primary focus-visible:shadow-lift focus-visible:outline-none"
                    >
                        {label}
                    </button>
                ))}
            </div>

            {!board ? (
                <p className="text-sm text-muted">Loading&hellip;</p>
            ) : view === 'cup' ? (
                <MoonCup cup={board.cup} />
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted">
                    Nobody&rsquo;s on the board yet. Be the first.
                </p>
            ) : (
                <ol className="grid gap-1">
                    {top.map(row)}
                    {mine && (
                        <>
                            <li aria-hidden className="text-center text-muted">
                                &hellip;
                            </li>
                            {row(mine)}
                        </>
                    )}
                </ol>
            )}
            {view === 'stage' && (
                <p className="text-xs text-muted">
                    Ranked by stage, then streak. Only people who joined are
                    shown.
                </p>
            )}
        </section>
    );
}

/** This office week's duel wins. Nobody with no wins is listed, so there is no last place. */
function MoonCup({ cup }: { cup: CupRow[] }) {
    const top = cup.filter((r) => r.rank <= 10);
    const mine = cup.find((r) => r.rank > 10);
    const row = (r: CupRow) => (
        <li
            key={r.rank}
            aria-current={r.me ? 'true' : undefined}
            className={`flex items-center gap-3 px-3 py-2 ${r.me ? 'bg-surface-hover' : 'bg-bg'}`}
        >
            <span className="w-6 shrink-0 text-right font-mono text-sm text-muted">
                {r.rank}
            </span>
            <PetSprite
                stage={r.stage}
                title={r.stage_name}
                crown={r.crown}
                className="size-10"
            />
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                    {r.pet_name ?? `${r.first_name}’s moonling`}
                </span>
                <span className="block truncate text-xs text-muted">
                    {r.first_name}
                    {r.me ? ' · you' : ''}
                </span>
            </span>
            <span className="shrink-0 font-mono text-xs">
                {cupRecord(r.wins, r.losses)}
            </span>
        </li>
    );

    return (
        <>
            {cup.length === 0 ? (
                <p className="text-sm text-muted">
                    No wins yet this week. Win a moon duel to take the lead.
                </p>
            ) : (
                <ol className="grid gap-1">
                    {top.map(row)}
                    {mine && (
                        <>
                            <li aria-hidden className="text-center text-muted">
                                &hellip;
                            </li>
                            {row(mine)}
                        </>
                    )}
                </ol>
            )}
            <p className="text-xs text-muted">
                Wins this week, Monday to Sunday; fewer losses breaks a tie. It
                starts over every Monday, and last week&rsquo;s champion wears
                the crown 👑.
            </p>
        </>
    );
}

function BoardRow({
    row,
    can,
    picking,
    saving,
    onChallenge,
    onPick,
}: {
    row: Row;
    can: boolean;
    picking: boolean;
    saving: boolean;
    onChallenge: () => void;
    onPick: (pick: DuelPick) => void;
}) {
    return (
        <li
            aria-current={row.me ? 'true' : undefined}
            className={row.me ? 'bg-surface-hover' : 'bg-bg'}
        >
            <div className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 shrink-0 text-right font-mono text-sm text-muted">
                    {row.rank}
                </span>
                <PetSprite
                    stage={row.stage}
                    title={row.stage_name}
                    crown={row.crown}
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
                {can && (
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={picking}
                        onClick={onChallenge}
                    >
                        {picking ? 'Cancel' : 'Challenge'}
                    </Button>
                )}
            </div>
            {picking && (
                <div className="px-3 pb-3">
                    <p className="mb-2 text-xs text-muted">
                        Pick your move. {row.first_name} won&rsquo;t see it
                        until they answer.
                    </p>
                    <PickTiles disabled={saving} onPick={onPick} />
                </div>
            )}
        </li>
    );
}

/** The three moves as big tiles (tap targets well over 40px). Shared with the Duels tab. */
export function PickTiles({
    disabled,
    onPick,
}: {
    disabled: boolean;
    onPick: (pick: DuelPick) => void;
}) {
    return (
        <div className="grid grid-cols-3 gap-1">
            {DUEL_PICKS.map((p) => (
                <button
                    key={p.pick}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(p.pick)}
                    className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 bg-surface px-2 py-2 hover:bg-primary hover:text-on-primary focus-visible:bg-primary focus-visible:text-on-primary focus-visible:outline-none disabled:opacity-50"
                >
                    <span aria-hidden className="text-2xl leading-none">
                        {p.icon}
                    </span>
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="text-[11px] leading-tight opacity-80">
                        {p.beats}
                    </span>
                </button>
            ))}
        </div>
    );
}
