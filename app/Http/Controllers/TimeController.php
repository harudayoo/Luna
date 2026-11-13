<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLateRequest;
use App\Models\LateLog;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\Payroll\PaySchedule;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Time: your four stamps today (a record) and the lates you declare (charged on the payslip's Tardiness
 * line). Declaring a late sends you on to WIP's Attendance channel, where the office reads it.
 */
class TimeController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::parse(TimeLog::officeNow()->toDateString());
        [$start, $end] = PaySchedule::periodFor($today);
        [, $pesos, $minutes] = LateLog::tardiness($user, $start, $end);

        return Inertia::render('time/index', [
            'today' => self::today($user),
            'period' => ['start' => $start->toDateString(), 'end' => $end->toDateString(), 'minutes' => $minutes, 'pesos' => $pesos],
            'lates' => $user->lateLogs()->orderByDesc('date')->orderByDesc('start_time')->limit(60)->get()
                ->map(fn (LateLog $l) => self::late($l) + [
                    'locked' => $user->payslips()->whereNotNull('released_on')->where('period_start', '<=', $l->date->toDateString())
                        ->where('period_end', '>=', $l->date->toDateString())->exists(),
                ]),
            'kinds' => LateLog::KINDS,
            'wip_attendance' => self::wipAttendance(),
        ]);
    }

    /** The next stamp of the day, at the office time now. The client sends which one, so a double tap can't skip ahead. */
    public function stamp(Request $request): RedirectResponse
    {
        $request->validate(['step' => ['required', Rule::in(TimeLog::STEPS)]]);
        /** @var User $user */
        $user = $request->user();
        $now = TimeLog::officeNow();
        $log = $user->timeLogs()->firstOrNew(['date' => $now->toDateString()]);
        $step = $request->input('step');

        if (! in_array($step, $log->allowedSteps(), true)) {
            throw ValidationException::withMessages(['step' => $log->{$step} !== null
                ? 'Already logged at '.self::label($log->{$step}).'.'
                : 'Not yet: log '.self::STEP_LABELS[$log->allowedSteps()[0] ?? 'time_out'].' first.']);
        }

        $log->{$step} = $now->format('H:i');
        $log->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => self::STEP_LABELS[$step].' at '.$now->format('g:i A').'.']);

        return back();
    }

    public function storeLate(StoreLateRequest $request): RedirectResponse
    {
        $late = $request->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => LateLog::KINDS[$late->kind].' logged: '.$late->minutes.' min.']);

        return back();
    }

    public function destroyLate(Request $request, LateLog $late): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $released = $late->user->payslips()->whereNotNull('released_on')
            ->where('period_start', '<=', $late->date->toDateString())->where('period_end', '>=', $late->date->toDateString())->exists();
        abort_unless($user->can('hr') || ($late->user_id === $user->id && ! $released), 403);

        $late->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Late on '.$late->date->format('M j').' removed.']);

        return back();
    }

    public const STEP_LABELS = ['time_in' => 'Time in', 'lunch_start' => 'Lunch start', 'lunch_end' => 'Lunch end', 'time_out' => 'Time out'];

    /** Today's stamps for Home and Time: the four times and the next step (null once timed out). */
    public static function today(User $user): array
    {
        $date = TimeLog::officeNow()->toDateString();
        $log = $user->timeLogs()->where('date', $date)->first() ?? new TimeLog(['date' => $date]);

        return ['date' => $date] + $log->only(TimeLog::STEPS) + [
            'next' => $log->allowedSteps()[0] ?? null,
            'can_skip_lunch' => in_array('time_out', $log->allowedSteps(), true) && $log->lunch_start === null,
        ];
    }

    /** @return array<string, mixed> */
    public static function late(LateLog $l): array
    {
        return [
            'id' => $l->id,
            'date' => $l->date->toDateString(),
            'kind' => $l->kind,
            'start_time' => $l->start_time,
            'end_time' => $l->end_time,
            'minutes' => $l->minutes,
            'note' => $l->note,
        ];
    }

    public static function wipAttendance(): string
    {
        return collect(config('luna.wip'))->firstWhere('key', 'attendance')['url'];
    }

    private static function label(string $time): string
    {
        return CarbonImmutable::createFromFormat('H:i', $time)->format('g:i A');
    }
}
