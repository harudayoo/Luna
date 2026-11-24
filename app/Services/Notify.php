<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Payslip;
use App\Models\User;
use App\Notifications\LunaNotice;
use App\Services\Payroll\PaySchedule;
use App\Services\Pto\CutOff;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Notification;

/**
 * Who hears about what in Luna's bell (spec 2026-11-24-luna-notifications). Nobody is told about their own action,
 * and only active people (not deactivated, invite accepted) are told anything.
 */
final class Notify
{
    public static function user(User $to, ?User $actor, LunaNotice $notice): void
    {
        if ($actor?->is($to) || $to->isDeactivated() || $to->isPendingInvite()) {
            return;
        }
        $to->notify($notice);
    }

    public static function hr(?User $actor, LunaNotice $notice): void
    {
        self::send(self::active()->whereIn('role', [Role::Hr->value, Role::Admin->value]), $actor, $notice);
    }

    public static function everyone(?User $actor, LunaNotice $notice): void
    {
        self::send(self::active(), $actor, $notice);
    }

    /**
     * After leave is saved for $owner: if a cut-off of $dates now has unpaid hours, tell the owner (even when they
     * logged it: it's a warning about their own balance) and HR, except whoever logged it.
     *
     * @param  list<CarbonImmutable>  $dates
     */
    public static function unpaidLeave(User $owner, User $actor, array $dates): void
    {
        $through = CarbonImmutable::today()->max(max($dates)->endOfYear());
        $cutOffs = collect($owner->ptoLedger(Policy::current(), $through))
            ->filter(fn (CutOff $c) => $c->deductedHours > 0 && collect($dates)->contains(fn ($d) => $c->contains($d)));

        foreach ($cutOffs as $c) {
            $hours = number_format($c->deductedHours, 2).' h';
            $period = self::range($c->start, $c->end);
            self::user($owner, null, new LunaNotice(
                'leave_unpaid', 'Leave beyond your PTO',
                "{$hours} of your leave in {$period} is more than your PTO balance and will be unpaid.",
                route('leave.index', [], false), 'leave',
            ));
            self::hr($actor, new LunaNotice(
                'leave_unpaid_hr', "{$owner->name}: unpaid leave",
                "{$hours} of {$owner->name}'s leave in {$period} will be unpaid.",
                route('people.leave', ['cutoff' => $c->start->toDateString()], false), 'people',
            ));
        }
    }

    /**
     * From 2 days before a pay period ends, remind $hr once if salaried people lack a released payslip for it.
     */
    public static function payslipsDue(User $hr): void
    {
        $today = CarbonImmutable::today();
        [$start, $end] = PaySchedule::periodFor($today);
        if ($today->lessThan($end->subDays(2)) || ! $hr->can('hr')) {
            return;
        }
        $already = $hr->notifications()->where('data->kind', 'payslips_due')->where('data->period', $start->toDateString())->exists();
        if ($already) {
            return;
        }
        $salaried = self::active()->whereNotNull('monthly_salary')->pluck('id');
        $released = Payslip::query()->whereIn('user_id', $salaried)->where('period_start', $start->toDateString())
            ->where('period_end', $end->toDateString())->whereNotNull('released_on')->count();
        $left = $salaried->count() - $released;
        if ($left <= 0) {
            return;
        }

        $hr->notify(new LunaNotice(
            'payslips_due', 'Payslips to release',
            "{$left} of {$salaried->count()} payslips for ".self::range($start, $end).' are not released yet.',
            route('people.payroll', ['cutoff' => $start->toDateString()], false), 'people',
            ['period' => $start->toDateString()],
        ));
    }

    /** "Nov 1–15" or "Nov 1–30". */
    public static function range(CarbonImmutable $start, CarbonImmutable $end): string
    {
        return $start->format('M j').'–'.$end->format('j');
    }

    /** @return Builder<User> */
    private static function active(): Builder
    {
        return User::query()->whereNull('deactivated_at')->whereNotNull('password');
    }

    /** @param  Builder<User>  $to */
    private static function send(Builder $to, ?User $actor, LunaNotice $notice): void
    {
        $people = $to->when($actor, fn ($q) => $q->whereKeyNot($actor->id))->get();
        if ($people->isNotEmpty()) {
            Notification::send($people, $notice);
        }
    }
}
