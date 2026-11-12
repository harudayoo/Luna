<?php

use App\Http\Controllers\PayslipController;
use Illuminate\Support\Facades\Route;

// Payslips: everyone sees and prints their own; HR prints anyone's (made under People → Payroll).
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('payslips', [PayslipController::class, 'index'])->name('payslips.index');
    Route::get('payslips/{payslip}/print', [PayslipController::class, 'print'])->name('payslips.print');
});
