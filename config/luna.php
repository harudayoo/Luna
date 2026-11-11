<?php

/*
 * Luna office defaults. HR can override the PTO policy in the app (stored as "pto.*" settings);
 * these values apply until then.
 */
return [

    'pto' => [
        // Hours earned per semi-monthly cut-off (1st-15th, 16th-month end).
        'accrual_hours' => 3.33,

        // Hours in a working day: a full day of leave takes this many hours.
        'hours_per_day' => 8,

        // full | unpaid | all; see App\Services\Pto\AccrualMode.
        'accrual_mode' => 'full',

        // Most days off per person per calendar month (a half day counts 0.5).
        'monthly_cap_days' => 10,
    ],

];
