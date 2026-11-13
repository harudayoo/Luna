<?php

use App\Http\Controllers\TimeController;
use Illuminate\Support\Facades\Route;

// Time: everyone stamps their own day (a record) and declares their own lates (charged on the payslip).
// HR fixes anyone's under People → Time.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('time', [TimeController::class, 'index'])->name('time.index');
    Route::post('time/stamp', [TimeController::class, 'stamp'])->name('time.stamp');
    Route::post('time/lates', [TimeController::class, 'storeLate'])->name('time.lates.store');
    Route::delete('time/lates/{late}', [TimeController::class, 'destroyLate'])->name('time.lates.destroy');
});
