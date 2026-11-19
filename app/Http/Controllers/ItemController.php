<?php

namespace App\Http\Controllers;

use App\Models\CompanyChannel;
use App\Models\Item;
use App\Models\ItemTime;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Items: the vault of work items. Your Personal items and everyone's Company items, by status (the legend:
 * On Queue, In Progress, On Hold, Done), each with the time spent on it (ItemTimeController).
 */
class ItemController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'scope' => ['nullable', Rule::in(array_keys(Item::SCOPES))],
            'status' => ['nullable', Rule::in(array_keys(Item::STATUSES))],
        ]);
        /** @var User $user */
        $user = $request->user();
        ItemTime::closeOverdue($user);

        $visible = Item::query()->visibleTo($user)->when($filters['scope'] ?? null, fn ($q, $s) => $q->where('scope', $s));
        $counts = (clone $visible)->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return Inertia::render('items/index', [
            'items' => $visible->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
                ->with(['user:id,name', 'times', 'channel.company'])->latest('updated_at')->get()
                ->map(fn (Item $i) => self::row($i, $user)),
            'counts' => collect(Item::STATUSES)->map(fn ($_, $k) => (int) ($counts[$k] ?? 0)),
            'filters' => ['scope' => $filters['scope'] ?? null, 'status' => $filters['status'] ?? null],
            'statuses' => Item::STATUSES,
            'running' => self::running($user),
            'channels' => self::channels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $item = $user->items()->create(self::validated($request) + ['status' => 'queue']);
        Inertia::flash('toast', ['type' => 'success', 'message' => "\"{$item->title}\" added to On Queue."]);

        // Unfiltered, so the new item is on screen whatever filter was on.
        return to_route('items.index');
    }

    public function show(Request $request, Item $item): Response
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($item->visibleTo($user), 403);
        ItemTime::closeOverdue($user);
        $item->load(['user:id,name', 'times.user:id,name', 'channel.company']);

        return Inertia::render('items/show', [
            'item' => self::row($item, $user) + [
                'notes' => $item->notes,
                'my_minutes' => $item->times->where('user_id', $user->id)->whereNotNull('ended_at')->sum(fn (ItemTime $t) => $t->minutes()),
                'can_edit' => $item->editableBy($user),
            ],
            'times' => $item->times->sortByDesc('started_at')->values()->map(fn (ItemTime $t) => [
                'id' => $t->id,
                'who' => $t->user->name,
                'mine' => $t->user_id === $user->id,
                'started_at' => $t->started_at->toIso8601String(),
                'ended_at' => $t->ended_at?->toIso8601String(),
                'minutes' => $t->minutes(),
                'countdown' => $t->target_minutes !== null,
            ]),
            'statuses' => Item::STATUSES,
            'running' => self::running($user),
            'today' => now(config('luna.office.timezone'))->toDateString(),
            'channels' => self::channels(),
        ]);
    }

    public function update(Request $request, Item $item): RedirectResponse
    {
        abort_unless($item->editableBy($request->user()), 403);
        $item->update(self::validated($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Item saved.']);

        return back();
    }

    public function status(Request $request, Item $item): RedirectResponse
    {
        abort_unless($item->visibleTo($request->user()), 403);
        $item->update($request->validate(['status' => ['required', Rule::in(array_keys(Item::STATUSES))]]));
        Inertia::flash('toast', ['type' => 'success', 'message' => "\"{$item->title}\" is ".Item::STATUSES[$item->status].'.']);

        return back();
    }

    public function destroy(Request $request, Item $item): RedirectResponse
    {
        abort_unless($item->editableBy($request->user()), 403);
        $item->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => "\"{$item->title}\" deleted."]);

        return to_route('items.index');
    }

    /** Every client channel, for the item form's picker. */
    private static function channels(): array
    {
        return CompanyChannel::query()->with('company')->get()
            ->sortBy(fn (CompanyChannel $c) => $c->label())->values()
            ->map(fn (CompanyChannel $c) => $c->toChannel())->all();
    }

    /** @return array{scope: string, channel_id: int|null, code: string|null, title: string, notes: string|null} */
    private static function validated(Request $request): array
    {
        return $request->validate([
            'scope' => ['required', Rule::in(array_keys(Item::SCOPES))],
            'channel_id' => ['nullable', 'integer', Rule::exists('company_channels', 'id')],
            'code' => ['nullable', 'string', 'max:40'],
            'title' => ['required', 'string', 'max:160'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /** One item as a list row: finished time only (a running clock shows on its own). */
    private static function row(Item $item, User $user): array
    {
        return [
            'id' => $item->id,
            'scope' => $item->scope,
            'channel' => $item->channel?->toChannel(),
            'code' => $item->code,
            'title' => $item->title,
            'status' => $item->status,
            'owner' => $item->user->name,
            'mine' => $item->user_id === $user->id,
            'total_minutes' => $item->times->whereNotNull('ended_at')->sum(fn (ItemTime $t) => $t->minutes()),
        ];
    }

    /** This person's running clock, if any: what Items and an item page tick from. */
    public static function running(User $user): ?array
    {
        $t = $user->itemTimes()->whereNull('ended_at')->with('item:id,title,code')->first();

        return $t ? [
            'id' => $t->id,
            'item_id' => $t->item_id,
            'title' => $t->item->title,
            'code' => $t->item->code,
            'started_at' => $t->started_at->toIso8601String(),
            'target_minutes' => $t->target_minutes,
        ] : null;
    }
}
