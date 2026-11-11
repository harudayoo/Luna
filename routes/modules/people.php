<?php

use App\Http\Controllers\Auth\AcceptInviteController;
use App\Http\Controllers\HolidayController;
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
    Route::post('people/{user}/leave', [TeamLeaveController::class, 'store'])->name('people.leave.store');
    Route::get('people/policy', [PolicyController::class, 'edit'])->name('people.policy');
    Route::put('people/policy', [PolicyController::class, 'update'])->name('people.policy.update');
    Route::get('people/holidays', [HolidayController::class, 'index'])->name('people.holidays');
    Route::post('people/holidays', [HolidayController::class, 'store'])->name('people.holidays.store');
    Route::patch('people/holidays/{holiday}', [HolidayController::class, 'update'])->name('people.holidays.update');
    Route::delete('people/holidays/{holiday}', [HolidayController::class, 'destroy'])->name('people.holidays.destroy');
    Route::patch('people/{user}', [PeopleController::class, 'update'])->name('people.update');
    Route::post('people/{user}/invite', [PeopleController::class, 'resendInvite'])->name('people.invite');
});

// Admin only: roles, and ending or restoring someone's access (deactivated accounts keep their history).
Route::middleware(['auth', 'verified', 'can:admin'])->group(function () {
    Route::patch('people/{user}/role', [PeopleController::class, 'updateRole'])->name('people.role');
    Route::patch('people/{user}/deactivate', [PeopleController::class, 'deactivate'])->name('people.deactivate');
    Route::patch('people/{user}/reactivate', [PeopleController::class, 'reactivate'])->name('people.reactivate');
});

// Invite links (User::inviteUrl): signed, expire after User::INVITE_DAYS, spent once a password is set.
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('invite/{user}', [AcceptInviteController::class, 'show'])->name('invite.show');
    Route::post('invite/{user}', [AcceptInviteController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('invite.accept');
});
