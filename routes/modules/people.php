<?php

use App\Http\Controllers\Auth\AcceptInviteController;
use App\Http\Controllers\PeopleController;
use App\Http\Controllers\PolicyController;
use App\Http\Controllers\TeamLeaveController;
use Illuminate\Support\Facades\Route;

// People (HR and admin): accounts and invites, each person's PTO values, everyone's leave and
// pay per cut-off, and the office leave policy. Only admin changes roles.
Route::middleware(['auth', 'verified', 'can:hr'])->group(function () {
    Route::get('people', [PeopleController::class, 'index'])->name('people.index');
    Route::post('people', [PeopleController::class, 'store'])->name('people.store');
    Route::get('people/leave', [TeamLeaveController::class, 'index'])->name('people.leave');
    Route::get('people/policy', [PolicyController::class, 'edit'])->name('people.policy');
    Route::put('people/policy', [PolicyController::class, 'update'])->name('people.policy.update');
    Route::patch('people/{user}', [PeopleController::class, 'update'])->name('people.update');
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
