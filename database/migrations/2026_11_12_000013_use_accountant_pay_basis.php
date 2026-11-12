<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data only: move stored values to the accountant's basis.
 * - A stored "pto.accrual_hours" of 3.33 is dropped, so the new default (exactly 10/3) applies.
 * - Daily rates still derived as monthly / 22 become monthly x 12 / 260. Rates HR typed by hand are left alone.
 * down() puts both back.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->where('key', 'pto.accrual_hours')->where('value', '3.33')->delete();
        $this->rederive(fn (float $m) => round($m / 22, 2), fn (float $m) => round($m * 12 / 260, 2));
    }

    public function down(): void
    {
        // The old default was 3.33, so a row is only needed if HR had one; restoring it is harmless either way.
        if (! DB::table('settings')->where('key', 'pto.accrual_hours')->exists()) {
            DB::table('settings')->insert(['key' => 'pto.accrual_hours', 'value' => '3.33', 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->rederive(fn (float $m) => round($m * 12 / 260, 2), fn (float $m) => round($m / 22, 2));
    }

    /** Re-derive each daily rate that still equals $from(monthly). */
    private function rederive(Closure $from, Closure $to): void
    {
        DB::table('users')->whereNotNull('monthly_salary')->whereNotNull('daily_rate')
            ->get(['id', 'monthly_salary', 'daily_rate'])
            ->each(function ($u) use ($from, $to) {
                $monthly = (float) $u->monthly_salary;
                if (abs((float) $u->daily_rate - $from($monthly)) < 0.005) {
                    DB::table('users')->where('id', $u->id)->update(['daily_rate' => $to($monthly)]);
                }
            });
    }
};
