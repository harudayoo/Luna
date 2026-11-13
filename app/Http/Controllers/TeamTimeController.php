<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLateRequest;
use App\Models\LateLog;
use App\Models\TimeLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * People → Time (HR): everyone's stamps and declared lates for a day. HR fixes a stamp or adds a late
 * someone forgot, including in a paid-out period.
 */
class TeamTimeController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $date = CarbonImmutable::parse($request->input('date', TimeLog::officeNow()->toDateString()));
        $logs = TimeLog::query()->where('date', $date->toDateString())->get()->keyBy('user_id');
        $lates = LateLog::query()->where('date', $date->toDateString())->orderBy('start_time')->get()->groupBy('user_id');

        $rows = User::query()->orderBy('id')->get()
            ->filter(fn (User $u) => ! $u->isDeactivated() || $logs->has($u->id) || $lates->has($u->id))
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                ...collect(TimeLog::STEPS)->mapWithKeys(fn ($s) => [$s => $logs->get($u->id)?->{$s}])->all(),
                'lates' => ($lates->get($u->id) ?? collect())->map(fn (LateLog $l) => TimeController::late($l))->values(),
            ])->values();

        return Inertia::render('people/time', [
            'date' => $date->toDateString(),
            'prev' => $date->subWeekday()->toDateString(),
            'next' => $date->addWeekday()->toDateString(),
            'is_today' => $date->toDateString() === TimeLog::officeNow()->toDateString(),
            'rows' => $rows,
            'kinds' => LateLog::KINDS,
        ]);
    }

    /** HR sets someone's four stamps for a day: each optional, but in order. All empty clears the day. */
    public function update(Request $request, User $user, string $date): RedirectResponse
    {
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $date) ?: abort(404);
        $times = $request->validate(array_fill_keys(TimeLog::STEPS, ['nullable', 'date_format:H:i']));

        $previous = null;
        foreach (TimeLog::STEPS as $step) {
            if (($times[$step] ?? null) === null) {
                continue;
            }
            if ($previous !== null && $times[$step] <= $previous) {
                throw ValidationException::withMessages([$step => 'Keep the times in order: in, lunch start, lunch end, out.']);
            }
            $previous = $times[$step];
        }

        $times = array_merge(array_fill_keys(TimeLog::STEPS, null), $times);
        if (array_filter($times) === []) {
            $user->timeLogs()->where('date', $day->toDateString())->delete();
        } else {
            $user->timeLogs()->updateOrCreate(['date' => $day->toDateString()], $times)
                ->forceFill(['edited_by' => $request->user()->id])->save();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name}'s times for {$day->format('M j')} saved."]);

        return back();
    }

    public function storeLate(StoreLateRequest $request, User $user): RedirectResponse
    {
        $late = $request->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name}: ".strtolower(LateLog::KINDS[$late->kind])." logged, {$late->minutes} min."]);

        return back();
    }
}
