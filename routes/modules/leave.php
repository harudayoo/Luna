<?php

use App\Http\Controllers\LeaveController;
use Illuminate\Support\Facades\Route;

// Leave: everyone logs and cancels their own; HR and admin may fix past cut-offs.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('leave', [LeaveController::class, 'index'])->name('leave.index');
    Route::post('leave', [LeaveController::class, 'store'])->name('leave.store');
    Route::delete('leave/{leave}', [LeaveController::class, 'destroy'])->name('leave.destroy');
});
