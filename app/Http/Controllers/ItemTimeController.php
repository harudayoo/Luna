<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\ItemTime;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Time on items: start a stopwatch or a countdown (one running per person; starting another stops the first),
 * stop it, or type a start-end in office time. A record only.
 */
class ItemTimeController extends Controller
{
    public function start(Request $request, Item $item): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($item->visibleTo($user), 403);
        $target = $request->validate(['target_minutes' => ['nullable', 'integer', 'min:1', 'max:600']])['target_minutes'] ?? null;

        ItemTime::stopRunning($user);
        $user->itemTimes()->create(['item_id' => $item->id, 'started_at' => CarbonImmutable::now(), 'target_minutes' => $target]);

        if (in_array($item->status, ['queue', 'hold'], true)) {
            $item->update(['status' => 'progress']);
        }

        return back();
    }

    public function stop(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $running = $user->itemTimes()->whereNull('ended_at')->first();
        ItemTime::stopRunning($user);

        if ($running) {
            $running->refresh();
            self::logged($running, $running->target_minutes && $running->minutes() >= $running->target_minutes ? "Time's up" : 'Stopped');
        }

        return back();
    }

    public function store(Request $request, Item $item): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($item->visibleTo($user), 403);
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after:start'],
        ], ['end.after' => 'End after it starts.']);

        $tz = config('luna.office.timezone');
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$data['date']} {$data['start']}", $tz)->utc();
        $end = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$data['date']} {$data['end']}", $tz)->utc();

        if ($end->gt(TimeLog::officeNow())) {
            throw ValidationException::withMessages(['end' => "Can't end later than now."]);
        }

        self::logged($user->itemTimes()->create(['item_id' => $item->id, 'started_at' => $start, 'ended_at' => $end]), 'Logged');

        return back();
    }

    /**
     * The hand-over to WIP: the time as WIP takes it and the item's board, for the done step on the page.
     * Items without a channel just get the toast.
     */
    private static function logged(ItemTime $time, string $verb): void
    {
        $item = $time->item()->with('channel.company')->first();
        $wip = ItemTime::wip($time->minutes());
        Pet::award($time->user, 'item_time', $item->id.':'.Pet::today());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$verb}: {$wip} on \"{$item->title}\"."]);
        Inertia::flash('item_logged', [
            'item_id' => $item->id,
            'code' => $item->code,
            'title' => $item->title,
            'minutes' => $time->minutes(),
            'wip' => $wip,
            'channel' => $item->channel?->toChannel(),
        ]);
    }

    public function destroy(Request $request, ItemTime $time): RedirectResponse
    {
        abort_unless($time->user_id === $request->user()->id, 403);
        $time->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Entry removed.']);

        return back();
    }
}
