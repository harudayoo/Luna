<?php

namespace App\Services\Payroll;

use App\Models\Payslip;
use App\Models\Setting;
use App\Services\Pto\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Which pay frequency applies when. Stored as the setting "pay.schedule": a list of changes
 * [{from: "Y-m-01", frequency}], oldest first. Before the first change (or with none) the default from
 * config/luna.php applies. A change starts on the 1st of a month HR picks, so payslips already made
 * keep their period.
 */
final class PaySchedule
{
    private const KEY = 'pay.schedule';

    /** @return list<array{from: string, frequency: string}> */
    public static function changes(): array
    {
        $raw = Setting::get(self::KEY);
        $list = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($list) ? array_values($list) : [];
    }

    public static function default(): PayFrequency
    {
        return PayFrequency::tryFrom((string) config('luna.pay.frequency')) ?? PayFrequency::Monthly;
    }

    public static function frequencyOn(CarbonImmutable $date): PayFrequency
    {
        $day = $date->toDateString();
        $frequency = self::default();
        foreach (self::changes() as $change) {
            if ($change['from'] <= $day) {
                $frequency = PayFrequency::from($change['frequency']);
            }
        }

        return $frequency;
    }

    /** The frequency a pay period was made with: a whole month is monthly, anything shorter a cut-off. */
    public static function frequencyOf(CarbonImmutable $start, CarbonImmutable $end): PayFrequency
    {
        return $start->day === 1 && $end->isSameDay($start->endOfMonth())
            ? PayFrequency::Monthly
            : PayFrequency::SemiMonthly;
    }

    /**
     * The pay period containing a date: its month, or its cut-off.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function periodFor(CarbonImmutable $date): array
    {
        $date = $date->startOfDay();

        return self::frequencyOn($date) === PayFrequency::Monthly
            ? [$date->startOfMonth(), $date->endOfMonth()->startOfDay()]
            : Ledger::cutOffFor($date);
    }

    /**
     * Pay with $frequency from the 1st of $month (Y-m) on; later changes are replaced. Refused if a
     * payslip already exists in or after that month, so no saved payslip ends up in the wrong period.
     */
    public static function change(PayFrequency $frequency, string $month): void
    {
        $from = CarbonImmutable::createFromFormat('!Y-m', $month)->startOfMonth()->toDateString();

        $made = Payslip::query()->where('period_end', '>=', $from)->orderByDesc('period_end')->value('period_end');
        if ($made !== null) {
            $next = CarbonImmutable::parse($made)->addMonthNoOverflow()->startOfMonth();
            throw ValidationException::withMessages([
                'from' => 'Payslips already exist for '.CarbonImmutable::parse($made)->format('F Y').'. Start the change in '.$next->format('F Y').' or later.',
            ]);
        }

        $kept = array_values(array_filter(self::changes(), fn ($c) => $c['from'] < $from));
        $before = self::default();
        foreach ($kept as $c) {
            $before = PayFrequency::from($c['frequency']);
        }
        if ($before !== $frequency) {
            $kept[] = ['from' => $from, 'frequency' => $frequency->value];
        }

        Setting::put(self::KEY, $kept === [] ? null : json_encode($kept));
    }
}
