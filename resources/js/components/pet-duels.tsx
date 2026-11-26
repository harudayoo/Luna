import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import PetDuelController from '@/actions/App/Http/Controllers/PetDuelController';
import InputError from '@/components/input-error';
import { PickTiles } from '@/components/pet-board';
import { PetSprite } from '@/components/pet-sprite';
import { Button } from '@/components/ui/button';
import { duelReveal } from '@/lib/ocs';
import type {
    DuelPick,
    MoonlingKind,
    Palette,
    Pet,
    PetDuelsData,
    WearItem,
} from '@/lib/pet';
import { DUEL_PICKS } from '@/lib/pet';

type Result = PetDuelsData['results'][number];

const PICK = Object.fromEntries(DUEL_PICKS.map((p) => [p.pick, p])) as Record<
    DuelPick,
    (typeof DUEL_PICKS)[number]
>;

const OUTCOME: Record<Result['outcome'], string> = {
    win: 'You won',
    loss: 'You lost',
    draw: 'Draw',
    declined: 'Declined',
    expired: 'Expired',
};

/**
 * Moon duels (spec 2026-11-25-luna-pet-social, slice 3): answer challenges, see the ones you sent, and the last
 * results with your tally. Answering plays the reveal. `revealLatest` replays the newest result when the panel is
 * opened from the bell (?pet=duels). No XP moves in a duel.
 */
export function PetDuels({
    pet,
    revealLatest,
}: {
    pet: Pet;
    revealLatest: boolean;
}) {
    const { pet_duels: duels, errors } = usePage<{
        pet_duels?: PetDuelsData;
        errors: Record<string, string>;
    }>().props;
    const [answering, setAnswering] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [revealId, setRevealId] = useState<number | null>(null);
    const autoRevealed = useRef(false);

    useEffect(() => {
        const latest = duels?.results[0];
        if (
            revealLatest &&
            !autoRevealed.current &&
            latest &&
            ['win', 'loss', 'draw'].includes(latest.outcome)
        ) {
            autoRevealed.current = true;
            setRevealId(latest.id);
        }
    }, [revealLatest, duels]);

    const send = (
        url: ReturnType<typeof PetDuelController.decline>,
        data: Record<string, string>,
        id: number,
        reveal: boolean,
    ) =>
        router.post(url, data, {
            preserveScroll: true,
            only: ['pet_duels', 'errors'],
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
            onSuccess: () => {
                setAnswering(null);
                if (reveal) {
                    setRevealId(id);
                }
            },
        });

    if (!duels) {
        return <p className="text-sm text-muted">Loading&hellip;</p>;
    }

    const revealed = duels.results.find((r) => r.id === revealId);
    const nothing =
        duels.incoming.length === 0 &&
        duels.sent.length === 0 &&
        duels.results.length === 0;

    return (
        <section aria-label="Moon duels" className="grid gap-4">
            <p className="flex flex-wrap items-baseline justify-between gap-2 bg-bg px-4 py-3 text-sm">
                <span>
                    Moon beats Star, Star beats Comet, Comet beats Moon.
                </span>
                <span className="font-mono text-xs text-muted">
                    W {duels.tally.win} · L {duels.tally.loss} · D{' '}
                    {duels.tally.draw}
                </span>
            </p>
            <InputError message={errors.duel} />

            {revealed && (
                <Reveal
                    result={revealed}
                    myStage={pet.stage}
                    myKind={pet.kind}
                    myPalette={pet.palette}
                    myWear={pet.wear}
                />
            )}

            {duels.incoming.length > 0 && (
                <div>
                    <p className="ocs-eyebrow">Challenges for you</p>
                    <ul className="grid gap-1">
                        {duels.incoming.map((d) => (
                            <li key={d.id} className="bg-bg px-3 py-2">
                                <div className="flex items-center gap-3">
                                    <PetSprite
                                        stage={d.stage}
                                        kind={d.kind}
                                        palette={d.palette}
                                        wear={d.wear}
                                        title={
                                            d.from_pet ?? `${d.from}’s moonling`
                                        }
                                        className="size-10"
                                    />
                                    <span className="min-w-0 flex-1 text-sm">
                                        <span className="font-semibold">
                                            {d.from}
                                        </span>{' '}
                                        challenged you
                                        {d.from_pet
                                            ? ` with ${d.from_pet}`
                                            : ''}
                                        .
                                    </span>
                                    {answering !== d.id && (
                                        <Button
                                            size="sm"
                                            onClick={() => setAnswering(d.id)}
                                        >
                                            Answer
                                        </Button>
                                    )}
                                </div>
                                {answering === d.id && (
                                    <div className="mt-2 grid gap-2">
                                        <PickTiles
                                            disabled={busy}
                                            onPick={(pick) =>
                                                send(
                                                    PetDuelController.answer(
                                                        d.id,
                                                    ),
                                                    { pick },
                                                    d.id,
                                                    true,
                                                )
                                            }
                                        />
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setAnswering(null)
                                                }
                                            >
                                                Not now
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={busy}
                                                onClick={() =>
                                                    send(
                                                        PetDuelController.decline(
                                                            d.id,
                                                        ),
                                                        {},
                                                        d.id,
                                                        false,
                                                    )
                                                }
                                            >
                                                Pass on it
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {duels.sent.length > 0 && (
                <div>
                    <p className="ocs-eyebrow">
                        Waiting for an answer ({duels.sent.length} of{' '}
                        {duels.open_sent_max})
                    </p>
                    <ul className="grid gap-1">
                        {duels.sent.map((d) => (
                            <li
                                key={d.id}
                                className="flex items-center justify-between gap-3 bg-bg px-3 py-2 text-sm"
                            >
                                <span>{d.to}</span>
                                <span className="text-xs text-muted">
                                    You picked {PICK[d.pick].icon}{' '}
                                    {PICK[d.pick].label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {duels.results.length > 0 && (
                <div>
                    <p className="ocs-eyebrow">Recent duels</p>
                    <ul className="grid gap-1">
                        {duels.results.map((r) => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    disabled={
                                        !['win', 'loss', 'draw'].includes(
                                            r.outcome,
                                        )
                                    }
                                    onClick={() => setRevealId(r.id)}
                                    className="flex w-full items-center gap-3 bg-bg px-3 py-2 text-left text-sm enabled:cursor-pointer enabled:hover:bg-surface-hover"
                                >
                                    <span
                                        className={`w-18 shrink-0 font-semibold ${r.outcome === 'win' ? 'text-primary' : ''}`}
                                    >
                                        {OUTCOME[r.outcome]}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        vs {r.against}
                                    </span>
                                    <span aria-hidden className="shrink-0">
                                        {r.mine ? PICK[r.mine].icon : '·'} :{' '}
                                        {r.theirs ? PICK[r.theirs].icon : '·'}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {nothing && (
                <p className="text-sm text-muted">
                    No duels yet. Challenge someone from the office board.
                </p>
            )}
            <p className="text-xs text-muted">
                Just for fun: a pet&rsquo;s stage doesn&rsquo;t matter, and no
                XP is won or lost.
            </p>
        </section>
    );
}

/** Both pets face each other, the moves flip over, the winner hops and the other squishes (lib/ocs.ts duelReveal). */
function Reveal({
    result,
    myStage,
    myKind,
    myPalette,
    myWear,
}: {
    result: Result;
    myStage: number;
    myKind: MoonlingKind;
    myPalette: Palette;
    myWear: WearItem[];
}) {
    const ref = useRef<HTMLDivElement>(null);
    const role = (who: 'me' | 'them') =>
        result.outcome === 'draw'
            ? {}
            : (result.outcome === 'win') === (who === 'me')
              ? { 'data-duel-winner': '' }
              : { 'data-duel-loser': '' };

    useEffect(() => {
        if (ref.current) {
            duelReveal(ref.current);
        }
    }, [result.id]);

    return (
        <div
            ref={ref}
            role="status"
            aria-label={`${OUTCOME[result.outcome]} against ${result.against}`}
            className="grid gap-2 bg-surface-hover px-4 py-4"
        >
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div className="flex flex-col items-center gap-1">
                    <span {...role('me')} className="inline-block">
                        <PetSprite
                            stage={myStage}
                            kind={myKind}
                            palette={myPalette}
                            wear={myWear}
                            title="Your pet"
                            className="size-20"
                        />
                    </span>
                    <Move pick={result.mine} />
                    <span className="text-xs text-muted">You</span>
                </div>
                <span className="pb-10 text-sm font-semibold text-muted">
                    vs
                </span>
                <div className="flex flex-col items-center gap-1">
                    <span {...role('them')} className="inline-block">
                        {/* Facing you: mirrored (on an inner box, so the reveal's motion doesn't undo it). */}
                        <span className="inline-block -scale-x-100">
                            <PetSprite
                                stage={result.their_stage}
                                kind={result.their_kind}
                                palette={result.their_palette}
                                wear={result.their_wear}
                                title={`${result.against}’s pet`}
                                className="size-20"
                            />
                        </span>
                    </span>
                    <Move pick={result.theirs} />
                    <span className="text-xs text-muted">{result.against}</span>
                </div>
            </div>
            <p className="text-center text-lg font-semibold">
                {OUTCOME[result.outcome]}
                {result.outcome === 'draw' ? '!' : '.'}
            </p>
        </div>
    );
}

function Move({ pick }: { pick: DuelPick | null }) {
    return (
        <span
            data-duel-pick
            className="inline-flex items-center gap-1 bg-surface px-2 py-1 text-sm font-semibold"
        >
            <span aria-hidden>{pick ? PICK[pick].icon : '·'}</span>
            {pick ? PICK[pick].label : '—'}
        </span>
    );
}
