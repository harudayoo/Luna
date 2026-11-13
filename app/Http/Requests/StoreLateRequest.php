<?php

namespace App\Http\Requests;

use App\Models\Holiday;
use App\Models\LateLog;
use App\Models\Leave;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Declaring a late (LateLog): a weekday that isn't a holiday, not in the future, some office-hour time in the
 * span, and no overlap with the person's own leave or another late that day. Employees can't log into a pay
 * period whose payslip is released; HR can (People → Time logs for someone: route has {user}).
 */
class StoreLateRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'kind' => ['required', Rule::in(array_keys(LateLog::KINDS))],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'note' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $v) => $v->errors()->isEmpty() && $this->checkTimes($v),
            fn (Validator $v) => $v->errors()->isEmpty() && $this->checkDate($v),
            fn (Validator $v) => $v->errors()->isEmpty() && $this->checkOverlap($v),
        ];
    }

    /** Whose late this is: the {user} HR picked, else the signed-in person. */
    public function owner(): User
    {
        /** @var User */
        return $this->route('user') ?? $this->user();
    }

    public function save(): LateLog
    {
        $late = $this->owner()->lateLogs()->make([
            ...$this->safe()->only(['date', 'kind', 'start_time', 'end_time', 'note']),
            'minutes' => LateLog::chargedMinutes($this->input('start_time'), $this->input('end_time')),
        ])->forceFill(['created_by' => $this->user()->id]);
        $late->save();

        return $late;
    }

    private function forSomeoneElse(): bool
    {
        return $this->route('user') !== null;
    }

    private function checkTimes(Validator $v): void
    {
        $start = $this->input('start_time');
        $end = $this->input('end_time');

        if ($end <= $start) {
            $v->errors()->add('end_time', 'End after the start time.');
        } elseif (LateLog::chargedMinutes($start, $end) === 0) {
            $v->errors()->add('end_time', 'That’s all outside office hours (9–12, 1–6): nothing to log.');
        }
    }

    private function checkDate(Validator $v): void
    {
        $date = CarbonImmutable::parse($this->input('date'));
        $today = CarbonImmutable::parse(TimeLog::officeNow()->toDateString());
        $holiday = Holiday::names($date->toDateString(), $date->toDateString())[$date->toDateString()] ?? null;

        $message = match (true) {
            $date->isWeekend() => 'Pick a weekday.',
            $holiday !== null => $date->format('M j').' is '.$holiday.'.',
            $date->greaterThan($today) => 'Log a late on the day or after it, not ahead.',
            $date->lessThan(Policy::officeStartedOn()) => 'That’s before the office started.',
            ! $this->forSomeoneElse() && $this->owner()->payslips()->whereNotNull('released_on')
                ->where('period_start', '<=', $date->toDateString())->where('period_end', '>=', $date->toDateString())->exists() => 'That pay period is paid out. Ask HR to add it.',
            default => null,
        };

        if ($message !== null) {
            $v->errors()->add('date', $message);
        }
    }

    /** Not over the person's leave that day (full day, a half, or some hours) or another late. */
    private function checkOverlap(Validator $v): void
    {
        $owner = $this->owner();
        $date = $this->input('date');
        $minutes = fn (string $t) => (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2);
        $start = $minutes($this->input('start_time'));
        $end = $minutes($this->input('end_time'));
        $overlaps = fn (string $from, string $to) => max($start, $minutes($from)) < min($end, $minutes($to));
        $self = $owner->id === $this->user()->id;

        $leave = $owner->leaves()->where('date', $date)->get()->first(function (Leave $l) use ($overlaps) {
            [$from, $to] = match (true) {
                $l->start_time !== null => [$l->start_time, $l->end_time],
                $l->part !== null => Leave::HALVES[$l->part],
                default => [Leave::OFFICE_HOURS[0][0], Leave::OFFICE_HOURS[array_key_last(Leave::OFFICE_HOURS)][1]],
            };

            return $overlaps($from, $to);
        });
        if ($leave) {
            $v->errors()->add('start_time', ($self ? 'You’re' : explode(' ', $owner->name)[0].' is').' on leave then.');

            return;
        }

        $late = $owner->lateLogs()->where('date', $date)->get()->first(fn (LateLog $l) => $overlaps($l->start_time, $l->end_time));
        if ($late) {
            $v->errors()->add('start_time', "Overlaps the late already logged ({$late->start_time}–{$late->end_time}).");
        }
    }
}
