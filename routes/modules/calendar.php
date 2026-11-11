<?php

use App\Http\Controllers\CalendarController;
use Illuminate\Support\Facades\Route;

// Calendar: everyone signed in sees the office's leave and holidays.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('calendar', [CalendarController::class, 'index'])->name('calendar.index');
});
