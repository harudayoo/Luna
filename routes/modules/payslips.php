<?php

use App\Http\Controllers\PayslipController;
use Illuminate\Support\Facades\Route;

// Payslips: everyone's own list. Employees see (and print) only payslips HR has released; HR and admin
// (HR, accountant, office manager) see all their own and print anyone's (made under People → Payroll).
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('payslips', [PayslipController::class, 'index'])->name('payslips.index');
    Route::get('payslips/{payslip}/print', [PayslipController::class, 'print'])->name('payslips.print');
});
