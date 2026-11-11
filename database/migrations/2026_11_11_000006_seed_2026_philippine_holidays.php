<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The 2026 Philippine holidays from Proclamation No. 1006 (s. 2025). Eid'l Fitr and Eid'l Adha
 * are proclaimed separately; HR adds them. Feb 25 (EDSA) is a special *working* day, so it's not here.
 */
return new class extends Migration
{
    private const HOLIDAYS = [
        ['2026-01-01', 'New Year’s Day', 'regular'],
        ['2026-02-17', 'Chinese New Year', 'special'],
        ['2026-04-02', 'Maundy Thursday', 'regular'],
        ['2026-04-03', 'Good Friday', 'regular'],
        ['2026-04-04', 'Black Saturday', 'special'],
        ['2026-04-09', 'Araw ng Kagitingan', 'regular'],
        ['2026-05-01', 'Labor Day', 'regular'],
        ['2026-06-12', 'Independence Day', 'regular'],
        ['2026-08-21', 'Ninoy Aquino Day', 'special'],
        ['2026-08-31', 'National Heroes Day', 'regular'],
        ['2026-11-01', 'All Saints’ Day', 'special'],
        ['2026-11-02', 'All Souls’ Day', 'special'],
        ['2026-11-30', 'Bonifacio Day', 'regular'],
        ['2026-12-08', 'Feast of the Immaculate Conception', 'special'],
        ['2026-12-24', 'Christmas Eve', 'special'],
        ['2026-12-25', 'Christmas Day', 'regular'],
        ['2026-12-30', 'Rizal Day', 'regular'],
        ['2026-12-31', 'Last Day of the Year', 'special'],
    ];

    public function up(): void
    {
        $now = now();

        DB::table('holidays')->insertOrIgnore(array_map(fn ($h) => [
            'date' => $h[0],
            'name' => $h[1],
            'kind' => $h[2],
            'created_at' => $now,
            'updated_at' => $now,
        ], self::HOLIDAYS));
    }

    public function down(): void
    {
        DB::table('holidays')->whereIn('date', array_column(self::HOLIDAYS, 0))->delete();
    }
};
