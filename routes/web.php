<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PetController;
use App\Http\Controllers\PetDuelController;
use App\Http\Controllers\WipTileController;
use Illuminate\Support\Facades\Route;

// Internal app: no landing page. Guests bounce on to the login page from here.
Route::redirect('/', '/dashboard')->name('home');

Route::get('dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// The WIP channels people pin on their own Home: part of Home, not a module.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('wip-tiles', [WipTileController::class, 'store'])->name('wip-tiles.store');
    Route::put('wip-tiles/{tile}', [WipTileController::class, 'update'])->name('wip-tiles.update');
    Route::delete('wip-tiles/{tile}', [WipTileController::class, 'destroy'])->name('wip-tiles.destroy');

    // Your pet on Home (spec 2026-11-25-luna-pet-social).
    Route::patch('pet', [PetController::class, 'update'])->name('pet.update');
    Route::post('pet/pat', [PetController::class, 'pat'])->name('pet.pat');
    Route::patch('pet/active', [PetController::class, 'active'])->name('pet.active');
    Route::patch('pet/moonlings/{moonling}', [PetController::class, 'dress'])->name('pet.moonlings.update');
    Route::post('pet/duels', [PetDuelController::class, 'store'])->name('pet.duels.store');
    Route::post('pet/duels/{duel}/answer', [PetDuelController::class, 'answer'])->name('pet.duels.answer');
    Route::post('pet/duels/{duel}/decline', [PetDuelController::class, 'decline'])->name('pet.duels.decline');

    // The bell in the top bar (components/notification-bell.tsx): part of the shell, not a module.
    Route::get('notifications/{id}', [NotificationController::class, 'open'])->name('notifications.open');
    Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
});

// Each feature module keeps its routes in routes/modules/<module>.php (see resources/js/modules.ts).
foreach (glob(__DIR__.'/modules/*.php') as $module) {
    require $module;
}

require __DIR__.'/settings.php';
