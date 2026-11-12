<?php

/*
 * Luna office defaults. HR can override the PTO policy in the app (stored as "pto.*" settings);
 * these values apply until then.
 */
return [

    'office' => [
        // When OCSPH office operations began: everyone's PTO accrues from here unless HR
        // gives them a later start date. Leave can't be logged before it.
        'started_on' => '2026-08-18',
    ],

    'pto' => [
        // Hours earned per semi-monthly cut-off (1st-15th, 16th-month end): exactly 10/3 a
        // cut-off, so 6.67 h a month and 80 h (10 days) a year (the accountant's 3.33, 6.67, 10.00 ...
        // over successive cut-offs). Kept unrounded.
        'accrual_hours' => 10 / 3,

        // Hours in a working day: a full day of leave takes this many hours.
        'hours_per_day' => 8,

        // full | unpaid | all | forfeit; see App\Services\Pto\AccrualMode. The office rule (accountant,
        // 2026-11-12) is forfeit: any leave in a cut-off loses that cut-off's accrual.
        'accrual_mode' => 'forfeit',

        // Most days off per person per calendar month (a half day counts 0.5).
        'monthly_cap_days' => 10,
    ],

    'pay' => [
        // The accountant's rate basis: 5 days x 52 weeks. Daily rate = monthly x 12 / this
        // (21.67 days a month), hourly = daily / hours_per_day. Monthly 60,000 is 346.15 an hour.
        'work_days_per_year' => 260,

        // monthly | semi_monthly (App\Services\Payroll\PayFrequency). The office has been paid monthly
        // since August 2026; HR switches to per cut-off from a month they pick (People → Formulas).
        'frequency' => 'monthly',
    ],

];
