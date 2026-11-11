<?php

namespace Tests\Unit;

use App\Services\Pto\AccrualMode;
use App\Services\Pto\CutOff;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * The expected figures are golden values produced by running the old single-file planner's
 * engine (index.html: settle/buildSemi/workHours) verbatim in Node on 2026-11-11.
 * Columns: start, end, start balance, accrued, taken h, balance, deducted h.
 */
class PtoLedgerTest extends TestCase
{
    private const LEAVES = [
        ['date' => '2026-10-05', 'days' => 1.0],
        ['date' => '2026-10-06', 'days' => 0.5],
        ['date' => '2026-10-20', 'days' => 1.0],
        ['date' => '2026-11-03', 'days' => 1.0],
        ['date' => '2026-11-04', 'days' => 1.0],
    ];

    public function test_full_accrual_matches_the_planner()
    {
        $this->assertRows([
            ['2026-10-01', '2026-10-15', 0, 3.33, 12, -8.67, 8.67],
            ['2026-10-16', '2026-10-31', 0, 3.33, 8, -4.67, 4.67],
            ['2026-11-01', '2026-11-15', 0, 3.33, 16, -12.67, 12.67],
            ['2026-11-16', '2026-11-30', 0, 3.33, 0, 3.33, 0],
        ], $this->ledger(AccrualMode::Full, '2026-10-01', 0));
    }

    public function test_no_accrual_on_unpaid_hours_matches_the_planner()
    {
        $this->assertRows([
            ['2026-10-01', '2026-10-15', 0, 2.99, 12, -9.01, 9.01],
            ['2026-10-16', '2026-10-31', 0, 3.15, 8, -4.85, 4.85],
            ['2026-11-01', '2026-11-15', 0, 2.78, 16, -13.22, 13.22],
            ['2026-11-16', '2026-11-30', 0, 3.33, 0, 3.33, 0],
        ], $this->ledger(AccrualMode::Unpaid, '2026-10-01', 0));
    }

    public function test_no_accrual_on_any_leave_matches_the_planner()
    {
        $this->assertRows([
            ['2026-10-01', '2026-10-15', 0, 2.88, 12, -9.12, 9.12],
            ['2026-10-16', '2026-10-31', 0, 3.03, 8, -4.97, 4.97],
            ['2026-11-01', '2026-11-15', 0, 2.66, 16, -13.34, 13.34],
            ['2026-11-16', '2026-11-30', 0, 3.33, 0, 3.33, 0],
        ], $this->ledger(AccrualMode::All, '2026-10-01', 0));
    }

    public function test_mid_month_start_with_opening_balance_ignores_earlier_leave()
    {
        $this->assertRows([
            ['2026-10-16', '2026-10-31', 5, 3.33, 8, 0.33, 0],
            ['2026-11-01', '2026-11-15', 0.33, 3.33, 16, -12.34, 12.34],
            ['2026-11-16', '2026-11-30', 0, 3.33, 0, 3.33, 0],
            ['2026-12-01', '2026-12-15', 3.33, 3.33, 0, 6.66, 0],
        ], $this->ledger(AccrualMode::Full, '2026-10-16', 5));
    }

    public function test_it_runs_to_the_end_of_the_year_of_today_or_the_last_leave()
    {
        $rows = $this->ledger(AccrualMode::Full, '2026-10-01', 0);

        $this->assertSame('2026-12-31', $rows[array_key_last($rows)]->end->toDateString());
    }

    public function test_cut_offs_are_the_1st_to_15th_and_16th_to_month_end()
    {
        $this->assertSame(['2027-02-01', '2027-02-15'], $this->dates(Ledger::cutOffFor(CarbonImmutable::parse('2027-02-09'))));
        $this->assertSame(['2027-02-16', '2027-02-28'], $this->dates(Ledger::cutOffFor(CarbonImmutable::parse('2027-02-16'))));
    }

    public function test_holidays_are_not_work_hours_so_prorated_accrual_uses_fewer_hours()
    {
        // Nov 1-15 has 10 weekdays (80 h); Nov 2 is a holiday, so 72 h. 3.33 x (1 - 16/72) = 2.59.
        $rows = Ledger::build(
            new Policy(accrualHours: 3.33, hoursPerDay: 8, mode: AccrualMode::All, monthlyCapDays: 10),
            CarbonImmutable::parse('2026-11-01'),
            0,
            [['date' => '2026-11-03', 'days' => 1.0], ['date' => '2026-11-04', 'days' => 1.0]],
            CarbonImmutable::parse('2026-11-11'),
            ['2026-11-02'],
        );

        $this->assertRows([['2026-11-01', '2026-11-15', 0, 2.59, 16, -13.41, 13.41]], $rows);
    }

    public function test_leave_on_a_holiday_is_not_charged()
    {
        $rows = Ledger::build(
            new Policy(accrualHours: 3.33, hoursPerDay: 8, mode: AccrualMode::Full, monthlyCapDays: 10),
            CarbonImmutable::parse('2026-11-01'),
            0,
            [['date' => '2026-11-02', 'days' => 1.0], ['date' => '2026-11-03', 'days' => 1.0]],
            CarbonImmutable::parse('2026-11-11'),
            ['2026-11-02'],
        );

        $this->assertRows([['2026-11-01', '2026-11-15', 0, 3.33, 8, -4.67, 4.67]], $rows);
        $this->assertSame(['2026-11-03'], array_column($rows[0]->leaves, 'date'));
    }

    /** @return list<CutOff> */
    private function ledger(AccrualMode $mode, string $start, float $opening): array
    {
        return Ledger::build(
            new Policy(accrualHours: 3.33, hoursPerDay: 8, mode: $mode, monthlyCapDays: 10),
            CarbonImmutable::parse($start),
            $opening,
            self::LEAVES,
            CarbonImmutable::parse('2026-11-11'),
        );
    }

    /** @param list<CutOff> $rows */
    private function assertRows(array $expected, array $rows): void
    {
        foreach ($expected as $i => [$start, $end, $startBalance, $accrued, $taken, $balance, $deducted]) {
            $row = $rows[$i];
            $this->assertSame([$start, $end], [$row->start->toDateString(), $row->end->toDateString()], "row $i dates");
            $this->assertEqualsWithDelta(
                [$startBalance, $accrued, $taken, $balance, $deducted],
                [$row->startBalance, $row->accrued, $row->takenHours, $row->balance, $row->deductedHours],
                0.0001,
                "row $i ($start)",
            );
        }
    }

    /** @param array{0: CarbonImmutable, 1: CarbonImmutable} $range */
    private function dates(array $range): array
    {
        return [$range[0]->toDateString(), $range[1]->toDateString()];
    }
}
