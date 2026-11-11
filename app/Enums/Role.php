<?php

namespace App\Enums;

/**
 * Each role includes everything below it: employee < hr < admin.
 *
 * employee  own leave, balance and deductions; the shared calendar
 * hr        + invites, daily rates, everyone's leave and deductions, holidays, analytics
 * admin     + changing roles (the developer's account; recoverable with luna:make-admin)
 */
enum Role: string
{
    case Employee = 'employee';
    case Hr = 'hr';
    case Admin = 'admin';

    public function atLeast(self $role): bool
    {
        return $this->rank() >= $role->rank();
    }

    public function label(): string
    {
        return match ($this) {
            self::Employee => 'Employee',
            self::Hr => 'HR',
            self::Admin => 'Admin',
        };
    }

    private function rank(): int
    {
        return match ($this) {
            self::Employee => 0,
            self::Hr => 1,
            self::Admin => 2,
        };
    }
}
