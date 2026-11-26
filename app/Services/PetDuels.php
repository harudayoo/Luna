<?php

namespace App\Services;

use App\Models\PetDuel;
use App\Models\User;
use App\Notifications\LunaNotice;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Moon duels (spec 2026-11-25-luna-pet-social, slice 3): rock-paper-scissors between two pets on the office board.
 * Moon outshines Star, Star outlasts Comet, Comet eclipses Moon; the same pick is a draw. A pet's stage plays no part.
 * One open duel per pair, at most 3 open sent, and an open duel expires after 7 days (closed lazily, when duels are
 * next read or answered; there is no scheduler).
 *
 * Stakes (slice 4): the house pays both sides of an answered duel (XP below, through Pet::award with the office date
 * as ref, so only each person's first answered duel of the day pays; nobody ever loses XP), and the weekly Moon Cup
 * ranks this office week's wins; last week's champion (ties: all) wears a crown. Both read pet_duels, no extra table.
 */
final class PetDuels
{
    public const PICKS = ['moon', 'star', 'comet'];

    /** What each pick beats. */
    public const BEATS = ['moon' => 'star', 'star' => 'comet', 'comet' => 'moon'];

    public const OPEN_SENT_MAX = 3;

    public const EXPIRE_DAYS = 7;

    /** House XP for an answered duel, for each side. */
    public const XP = ['win' => 3, 'draw' => 1, 'loss' => 1];

    public static function challenge(User $from, User $to, string $pick): PetDuel
    {
        self::expireStale();
        $refuse = fn (string $why) => throw ValidationException::withMessages(['opponent_id' => $why]);

        if ($from->is($to)) {
            $refuse('You can’t duel your own pet.');
        }
        if (! self::onBoard($from)) {
            $refuse('Join the office board to duel.');
        }
        if (! self::onBoard($to)) {
            $refuse('That pet isn’t on the office board.');
        }
        if (self::open()->where(fn ($q) => $q
            ->where(fn ($q) => $q->where('challenger_id', $from->id)->where('opponent_id', $to->id))
            ->orWhere(fn ($q) => $q->where('challenger_id', $to->id)->where('opponent_id', $from->id)))->exists()) {
            $refuse('You already have a duel open with '.self::first($to).'.');
        }
        if (self::open()->where('challenger_id', $from->id)->count() >= self::OPEN_SENT_MAX) {
            $refuse('You have '.self::OPEN_SENT_MAX.' challenges waiting. Wait for an answer first.');
        }

        $duel = PetDuel::query()->create([
            'challenger_id' => $from->id, 'opponent_id' => $to->id, 'challenger_pick' => $pick, 'status' => 'open',
        ]);

        Notify::user($to, $from, new LunaNotice(
            'pet_duel', 'Moon duel', self::first($from).' challenged your moonling to a moon duel.', self::url(), 'home',
        ));

        return $duel;
    }

    public static function answer(PetDuel $duel, User $opponent, string $pick): void
    {
        self::stillOpen($duel);

        $winner = match (true) {
            $pick === $duel->challenger_pick => null,
            self::BEATS[$duel->challenger_pick] === $pick => $duel->challenger_id,
            default => $duel->opponent_id,
        };
        $duel->update(['opponent_pick' => $pick, 'winner_id' => $winner, 'status' => 'done', 'answered_at' => now()]);

        $today = Pet::today();
        foreach ([$duel->challenger, $opponent] as $side) {
            Pet::award($side, 'duel', $today, self::XP[match ($winner) {
                null => 'draw',
                $side->id => 'win',
                default => 'loss',
            }]);
        }

        $result = match ($winner) {
            null => 'it’s a draw',
            $duel->challenger_id => 'you won',
            default => 'you lost',
        };
        Notify::user($duel->challenger, $opponent, new LunaNotice(
            'pet_duel_result', 'Moon duel result', self::first($opponent)." answered your moon duel: {$result}.", self::url(), 'home',
        ));
    }

    public static function decline(PetDuel $duel, User $opponent): void
    {
        self::stillOpen($duel);
        $duel->update(['status' => 'declined', 'answered_at' => now()]);

        Notify::user($duel->challenger, $opponent, new LunaNotice(
            'pet_duel_declined', 'Moon duel declined', self::first($opponent).' passed on your moon duel.', self::url(), 'home',
        ));
    }

    /**
     * The Duels tab: incoming (never with the challenger's pick), sent, the last 5 closed duels and the tally.
     *
     * @return array<string, mixed>
     */
    public static function tab(User $me): array
    {
        self::expireStale();
        $tz = config('luna.office.timezone');
        $at = fn (PetDuel $d) => $d->created_at->timezone($tz)->toDateString();

        $mine = fn ($q) => $q->where('challenger_id', $me->id)->orWhere('opponent_id', $me->id);
        $other = fn (PetDuel $d) => $d->challenger_id === $me->id ? $d->opponent_id : $d->challenger_id;
        $incoming = self::open()->where('opponent_id', $me->id)->with('challenger:id,name')->latest('id')->get();
        $results = PetDuel::query()->where('status', '!=', 'open')->where($mine)
            ->with(['challenger:id,name', 'opponent:id,name'])
            ->orderByDesc('updated_at')->orderByDesc('id')->limit(5)->get();
        // Stages and active moonlings of everyone shown, in one query each: incoming challengers, and who each
        // result was against.
        $shown = $incoming->pluck('challenger_id')->merge($results->map($other))->unique()->values()->all();
        $stages = Pet::stages($shown);
        $pets = Moonlings::activeOf($shown);

        $tally = ['win' => 0, 'loss' => 0, 'draw' => 0];
        foreach (PetDuel::query()->where('status', 'done')->where($mine)->pluck('winner_id') as $winner) {
            $tally[match ($winner) {
                null => 'draw',
                $me->id => 'win',
                default => 'loss',
            }]++;
        }

        return [
            'incoming' => $incoming->map(fn (PetDuel $d) => [
                'id' => $d->id,
                'from_id' => $d->challenger_id,
                'from' => self::first($d->challenger),
                'from_pet' => $pets[$d->challenger_id]->name ?? null,
                'kind' => $pets[$d->challenger_id]->kind ?? 'moon',
                'stage' => $stages[$d->challenger_id],
                'at' => $at($d),
            ])->values()->all(),
            'sent' => self::open()->where('challenger_id', $me->id)->with('opponent:id,name')->latest('id')->get()
                ->map(fn (PetDuel $d) => [
                    'id' => $d->id,
                    'to_id' => $d->opponent_id,
                    'to' => self::first($d->opponent),
                    'pick' => $d->challenger_pick,
                    'at' => $at($d),
                ])->values()->all(),
            'results' => $results
                ->map(function (PetDuel $d) use ($me, $at, $stages, $pets, $other) {
                    $challenged = $d->challenger_id === $me->id;

                    return [
                        'id' => $d->id,
                        'against' => self::first($challenged ? $d->opponent : $d->challenger),
                        // For the result reveal: both pets face each other.
                        'their_stage' => $stages[$other($d)],
                        'their_kind' => $pets[$other($d)]->kind ?? 'moon',
                        'mine' => $challenged ? $d->challenger_pick : $d->opponent_pick,
                        'theirs' => $challenged ? $d->opponent_pick : $d->challenger_pick,
                        'outcome' => $d->status !== 'done' ? $d->status : match ($d->winner_id) {
                            null => 'draw',
                            $me->id => 'win',
                            default => 'loss',
                        },
                        'at' => $at($d),
                    ];
                })->values()->all(),
            'tally' => $tally,
            'open_sent_max' => self::OPEN_SENT_MAX,
        ];
    }

    /**
     * The Moon Cup: this office week's wins (Mon–Sun, Manila) among people on the board, ranked by wins, then fewer
     * losses, then the earliest last win. Nobody with 0 wins. The top 10, plus your own row under them when lower.
     *
     * @return list<array<string, mixed>>
     */
    public static function cup(User $me): array
    {
        $standings = self::standings(0);
        $people = User::query()->whereIn('id', $standings->keys())->where('pet_public', true)
            ->whereNull('deactivated_at')->whereNotNull('password')->get(['id', 'name']);
        $stages = Pet::stages($people->pluck('id')->all());
        $pets = Moonlings::activeOf($people->pluck('id')->all());
        $champions = self::champions();

        $ranked = $people->map(fn (User $u) => [
            'user_id' => $u->id,
            'first_name' => self::first($u),
            'pet_name' => $pets[$u->id]->name ?? null,
            'kind' => $pets[$u->id]->kind ?? 'moon',
            'stage' => $stages[$u->id],
            'stage_name' => Pet::STAGE_NAMES[$stages[$u->id]],
            'wins' => $standings[$u->id]['wins'],
            'losses' => $standings[$u->id]['losses'],
            'me' => $u->is($me),
            'crown' => in_array($u->id, $champions, true),
            'sort' => [-$standings[$u->id]['wins'], $standings[$u->id]['losses'], $standings[$u->id]['last_win'], $u->name],
        ])->filter(fn (array $row) => $row['wins'] > 0)
            ->sort(fn (array $a, array $b) => $a['sort'] <=> $b['sort'])->values()
            ->map(fn (array $row, int $i) => ['rank' => $i + 1] + collect($row)->except('sort')->all());

        $rows = $ranked->take(10);
        $mine = $ranked->firstWhere('me', true);
        if ($mine && $mine['rank'] > 10) {
            $rows->push($mine);
        }

        return $rows->values()->all();
    }

    /**
     * Last office week's Moon Cup champions: the most wins, everyone tied for it; nobody when nobody won.
     *
     * @return list<int>
     */
    public static function champions(): array
    {
        $standings = self::standings(1);
        $most = $standings->max('wins') ?? 0;

        return $most > 0 ? $standings->where('wins', $most)->keys()->all() : [];
    }

    /**
     * Wins, losses and the time of the last win per person, over duels answered in an office week (0: this one,
     * 1: the one before). A draw counts for nobody.
     *
     * @return Collection<int, array{wins: int, losses: int, last_win: string}>
     */
    private static function standings(int $weeksBack): Collection
    {
        $start = CarbonImmutable::parse(Pet::today(), config('luna.office.timezone'))
            ->startOfWeek(CarbonImmutable::MONDAY)->subWeeks($weeksBack);

        $table = collect();
        $add = function (int $id, string $what, string $at = '') use ($table) {
            $row = $table->get($id, ['wins' => 0, 'losses' => 0, 'last_win' => '']);
            $row[$what]++;
            $row['last_win'] = max($row['last_win'], $at);
            $table->put($id, $row);
        };

        PetDuel::query()->where('status', 'done')->whereNotNull('winner_id')
            ->where('answered_at', '>=', $start->utc()->toDateTimeString())
            ->where('answered_at', '<', $start->addWeek()->utc()->toDateTimeString())
            ->toBase()->get(['challenger_id', 'opponent_id', 'winner_id', 'answered_at'])
            ->each(function ($d) use ($add) {
                $add((int) $d->winner_id, 'wins', (string) $d->answered_at);
                $add((int) ((int) $d->winner_id === (int) $d->challenger_id ? $d->opponent_id : $d->challenger_id), 'losses');
            });

        return $table;
    }

    /** Closes open duels nobody answered within EXPIRE_DAYS. */
    public static function expireStale(): void
    {
        PetDuel::query()->where('status', 'open')->where('created_at', '<=', now()->subDays(self::EXPIRE_DAYS))
            ->update(['status' => 'expired', 'updated_at' => now()]);
    }

    private static function stillOpen(PetDuel $duel): void
    {
        self::expireStale();
        if ($duel->fresh()->status !== 'open') {
            throw ValidationException::withMessages(['duel' => 'This duel has already closed.']);
        }
    }

    private static function onBoard(User $user): bool
    {
        return $user->pet_public && ! $user->isDeactivated() && ! $user->isPendingInvite();
    }

    private static function open()
    {
        return PetDuel::query()->where('status', 'open');
    }

    private static function first(User $user): string
    {
        return strtok($user->name, ' ') ?: $user->name;
    }

    private static function url(): string
    {
        return route('dashboard', ['pet' => 'duels'], false);
    }
}
