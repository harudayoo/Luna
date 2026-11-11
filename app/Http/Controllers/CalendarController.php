<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\Leave;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The shared calendar: everyone's leave and the office holidays, one month at a time. Names are
 * shared office-wide; notes stay private to their owner and HR. Leave on a holiday isn't shown
 * (the office is closed, and it isn't charged).
 */
class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $first = $request->filled('month')
            ? CarbonImmutable::createFromFormat('!Y-m', $request->input('month'))
            : $today->startOfMonth();
        $from = $first->toDateString();
        $to = $first->endOfMonth()->toDateString();

        $holidays = Holiday::query()->whereBetween('date', [$from, $to])->orderBy('date')->get();
        $closed = $holidays->map(fn (Holiday $h) => $h->date->toDateString())->all();
        $seeNotes = $user->can('hr');

        return Inertia::render('calendar/index', [
            'month' => $first->format('Y-m'),
            'prev' => $first->subMonth()->format('Y-m'),
            'next' => $first->addMonth()->format('Y-m'),
            'today' => $today->toDateString(),
            'holidays' => $holidays->map(fn (Holiday $h) => [
                'date' => $h->date->toDateString(),
                'name' => $h->name,
                'kind' => $h->kind,
            ]),
            'leaves' => Leave::query()
                ->with('user:id,name')
                ->whereBetween('date', [$from, $to])
                ->whereNotIn('date', $closed)
                ->orderBy('date')
                ->orderBy('user_id')
                ->get()
                ->map(fn (Leave $l) => [
                    'date' => $l->date->toDateString(),
                    'user_id' => $l->user_id,
                    'name' => $l->user->name,
                    'days' => (float) $l->days,
                    'mine' => $l->user_id === $user->id,
                    'note' => $seeNotes || $l->user_id === $user->id ? $l->note : null,
                ]),
        ]);
    }
}
