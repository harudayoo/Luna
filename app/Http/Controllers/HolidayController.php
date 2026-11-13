<?php

namespace App\Http\Controllers;

use App\Http\Requests\HolidayRequest;
use App\Models\Holiday;
use App\Models\Leave;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Holidays (HR): the office's public holidays, one year at a time. They aren't work hours and
 * can't be logged as leave. Leave already on a new holiday is kept uncharged unless HR cancels it;
 * cancelled leave comes back if the holiday is removed or moved.
 */
class HolidayController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['year' => ['nullable', 'integer', 'between:2000,2100']]);
        $year = (int) $request->input('year', CarbonImmutable::today()->year);

        $holidays = Holiday::query()
            ->whereBetween('date', ["$year-01-01", "$year-12-31"])
            ->orderBy('date')
            ->get();

        $leaveCounts = Leave::query()
            ->whereIn('date', $holidays->map(fn (Holiday $h) => $h->date->toDateString()))
            ->groupBy('date')
            ->selectRaw('date, count(*) as n')
            ->pluck('n', 'date')
            ->mapWithKeys(fn ($n, $date) => [substr((string) $date, 0, 10) => (int) $n]);

        return Inertia::render('people/holidays', [
            'year' => $year,
            'holidays' => $holidays->map(fn (Holiday $h) => [
                'id' => $h->id,
                'date' => $h->date->toDateString(),
                'name' => $h->name,
                'kind' => $h->kind,
                'leave_count' => $leaveCounts[$h->date->toDateString()] ?? 0,
            ]),
            // Leave per date, so the dialog can say how many people a new date affects.
            'leave_dates' => Leave::query()
                ->whereBetween('date', ["$year-01-01", "$year-12-31"])
                ->groupBy('date')
                ->selectRaw('date, count(*) as n')
                ->pluck('n', 'date')
                ->mapWithKeys(fn ($n, $date) => [substr((string) $date, 0, 10) => (int) $n]),
        ]);
    }

    public function store(HolidayRequest $request): RedirectResponse
    {
        $holiday = new Holiday($request->safe()->only(['date', 'name', 'kind']));
        $affected = DB::transaction(function () use ($request, $holiday) {
            $holiday->save();

            return $this->settleLeave($holiday, $request->boolean('cancel_leave'));
        });

        return $this->done($holiday, 'added', $affected, $request->boolean('cancel_leave'));
    }

    public function update(HolidayRequest $request, Holiday $holiday): RedirectResponse
    {
        $affected = DB::transaction(function () use ($request, $holiday) {
            $holiday->fill($request->safe()->only(['date', 'name', 'kind']));
            if ($holiday->isDirty('date')) {
                $this->restoreLeave($holiday);
            }
            $holiday->update($request->safe()->only(['date', 'name', 'kind']));

            return $this->settleLeave($holiday, $request->boolean('cancel_leave'));
        });

        return $this->done($holiday, 'saved', $affected, $request->boolean('cancel_leave'));
    }

    public function destroy(Holiday $holiday): RedirectResponse
    {
        $restored = DB::transaction(function () use ($holiday) {
            $restored = $this->restoreLeave($holiday);
            $holiday->delete();

            return $restored;
        });
        $message = $holiday->name.' removed. Leave on that date is charged again.';
        if ($restored > 0) {
            $message .= ' '.($restored === 1 ? '1 person’s cancelled leave is' : "$restored people’s cancelled leave is").' back.';
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('people.holidays', ['year' => $holiday->date->year]);
    }

    /**
     * Leave on the holiday's date: cancelled if asked, else kept (uncharged). Returns how many. Cancelled
     * leave is set aside, not deleted, so it comes back if the holiday is removed or moved (restoreLeave).
     */
    private function settleLeave(Holiday $holiday, bool $cancel): int
    {
        $query = Leave::query()->where('date', $holiday->date->toDateString());

        return $cancel ? $query->update(['cancelled_by_holiday_id' => $holiday->id]) : $query->count();
    }

    /** Brings back the leave this holiday cancelled. Returns how many. */
    private function restoreLeave(Holiday $holiday): int
    {
        return Leave::withoutGlobalScope('active')
            ->where('cancelled_by_holiday_id', $holiday->id)
            ->update(['cancelled_by_holiday_id' => null]);
    }

    private function done(Holiday $holiday, string $verb, int $leave, bool $cancelled): RedirectResponse
    {
        $message = $holiday->name.' '.$verb.'.';
        if ($leave > 0) {
            $people = $leave === 1 ? '1 person’s leave' : "$leave people’s leave";
            $message .= $cancelled ? " Cancelled $people on that date." : " $people on that date is kept but not charged.";
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('people.holidays', ['year' => $holiday->date->year]);
    }
}
