<?php

use App\Http\Controllers\Auth\AcceptInviteController;
use App\Http\Controllers\PeopleController;
use Illuminate\Support\Facades\Route;

// Internal app: no landing page. Guests bounce on to the login page from here.
Route::redirect('/', '/dashboard')->name('home');

// Invite links (User::inviteUrl): signed, expire after User::INVITE_DAYS, spent once a password is set.
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('invite/{user}', [AcceptInviteController::class, 'show'])->name('invite.show');
    Route::post('invite/{user}', [AcceptInviteController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('invite.accept');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::middleware('can:hr')->group(function () {
        Route::get('people', [PeopleController::class, 'index'])->name('people.index');
        Route::post('people', [PeopleController::class, 'store'])->name('people.store');
    });

    Route::patch('people/{user}/role', [PeopleController::class, 'updateRole'])
        ->middleware('can:admin')
        ->name('people.role');
});

require __DIR__.'/settings.php';
