<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

// Internal app: no landing page. Guests bounce on to the login page from here.
Route::redirect('/', '/dashboard')->name('home');

Route::get('dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Each feature module keeps its routes in routes/modules/<module>.php (see resources/js/modules.ts).
foreach (glob(__DIR__.'/modules/*.php') as $module) {
    require $module;
}

require __DIR__.'/settings.php';
