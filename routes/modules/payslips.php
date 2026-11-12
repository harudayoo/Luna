<?php

use App\Http\Controllers\PayslipController;
use Illuminate\Support\Facades\Route;

// Payslips are HR and admin only (HR, accountant, office manager): their own list, and printing anyone's
// (made under People → Payroll). Employees don't see payslips in Luna.
Route::middleware(['auth', 'verified', 'can:hr'])->group(function () {
    Route::get('payslips', [PayslipController::class, 'index'])->name('payslips.index');
    Route::get('payslips/{payslip}/print', [PayslipController::class, 'print'])->name('payslips.print');
});
