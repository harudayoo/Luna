<?php

use App\Http\Controllers\AnalyticsController;
use Illuminate\Support\Facades\Route;

// Analytics: everyone sees their own PTO; the office views are added for HR inside the controller.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
});
