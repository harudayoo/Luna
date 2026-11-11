<?php

use Illuminate\Support\Facades\Route;

// Internal app: no landing page. Guests bounce on to the login page from here.
Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
