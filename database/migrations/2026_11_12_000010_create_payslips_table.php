<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One payslip per person per cut-off. Pay details are copied in when it's saved, so a later raise or
 * position change never rewrites an issued payslip.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payslips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->date('issued_on');
            $table->string('position', 80)->nullable();
            $table->decimal('monthly_salary', 12, 2);
            $table->decimal('daily_rate', 12, 2);
            $table->decimal('basic_pay', 12, 2);
            $table->decimal('holiday_regular_days', 4, 1)->default(0);
            $table->decimal('holiday_special_days', 4, 1)->default(0);
            $table->decimal('holiday_pay', 12, 2)->default(0);
            $table->decimal('unpaid_hours', 6, 2)->default(0);
            $table->decimal('absences', 12, 2)->default(0);
            $table->decimal('overtime_allowance', 12, 2)->default(0);
            $table->decimal('gross_pay', 12, 2);
            $table->decimal('sss', 12, 2)->default(0);
            $table->decimal('philhealth', 12, 2)->default(0);
            $table->decimal('pagibig', 12, 2)->default(0);
            $table->decimal('withholding_tax', 12, 2)->default(0);
            $table->decimal('cash_advance', 12, 2)->default(0);
            $table->decimal('total_deductions', 12, 2);
            $table->decimal('net_pay', 12, 2);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslips');
    }
};
