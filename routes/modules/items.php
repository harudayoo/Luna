<?php

use App\Http\Controllers\ItemController;
use App\Http\Controllers\ItemTimeController;
use Illuminate\Support\Facades\Route;

// Items: everyone's vault of work items (Personal: their own; Company: shared) and the time spent on each,
// by stopwatch, countdown or a typed start-end. Who may see or change an item is checked per item.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('items', [ItemController::class, 'index'])->name('items.index');
    Route::post('items', [ItemController::class, 'store'])->name('items.store');
    Route::post('items/stop', [ItemTimeController::class, 'stop'])->name('items.stop');
    Route::delete('items/times/{time}', [ItemTimeController::class, 'destroy'])->name('items.times.destroy');
    Route::get('items/{item}', [ItemController::class, 'show'])->name('items.show');
    Route::put('items/{item}', [ItemController::class, 'update'])->name('items.update');
    Route::patch('items/{item}/status', [ItemController::class, 'status'])->name('items.status');
    Route::delete('items/{item}', [ItemController::class, 'destroy'])->name('items.destroy');
    Route::post('items/{item}/start', [ItemTimeController::class, 'start'])->name('items.start');
    Route::post('items/{item}/times', [ItemTimeController::class, 'store'])->name('items.times.store');
});
