<?php

use App\Http\Controllers\Auth\AcceptInviteController;
use App\Http\Controllers\PeopleController;
use Illuminate\Support\Facades\Route;

// People: HR and admin invite; only admin changes roles.
Route::middleware(['auth', 'verified', 'can:hr'])->group(function () {
    Route::get('people', [PeopleController::class, 'index'])->name('people.index');
    Route::post('people', [PeopleController::class, 'store'])->name('people.store');
});

Route::patch('people/{user}/role', [PeopleController::class, 'updateRole'])
    ->middleware(['auth', 'verified', 'can:admin'])
    ->name('people.role');

// Invite links (User::inviteUrl): signed, expire after User::INVITE_DAYS, spent once a password is set.
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('invite/{user}', [AcceptInviteController::class, 'show'])->name('invite.show');
    Route::post('invite/{user}', [AcceptInviteController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('invite.accept');
});
