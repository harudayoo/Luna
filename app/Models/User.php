<?php

namespace App\Models;

use App\Enums\Role;
use App\Services\Pto\CutOff;
use App\Services\Pto\Ledger;
use App\Services\Pto\Policy;
use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Role $role
 * @property string|null $daily_rate pesos; HR sets it
 * @property Carbon|null $pto_start null = the day the account was created
 * @property string $pto_opening_hours
 * @property Carbon|null $email_verified_at
 * @property string|null $password null while an invite is pending
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'daily_rate', 'pto_start', 'pto_opening_hours'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** How long an invite link stays valid. */
    public const INVITE_DAYS = 7;

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /** Same default as the column, so a model that was just created knows its role too. */
    protected $attributes = [
        'role' => 'employee',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'daily_rate' => 'decimal:2',
            'pto_start' => 'date',
            'pto_opening_hours' => 'decimal:2',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /** Invited but hasn't set a password yet. */
    public function isPendingInvite(): bool
    {
        return $this->password === null;
    }

    /** Signed set-password link; it stops working once a password is set. */
    public function inviteUrl(): string
    {
        return URL::temporarySignedRoute('invite.show', now()->addDays(self::INVITE_DAYS), ['user' => $this->id]);
    }

    /** @return HasMany<Leave, $this> */
    public function leaves(): HasMany
    {
        return $this->hasMany(Leave::class);
    }

    /** When PTO tracking starts for this person. */
    public function ptoStart(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->pto_start ?? $this->created_at ?? now())->startOfDay();
    }

    /**
     * This person's PTO ledger under the office policy.
     *
     * @return list<CutOff>
     */
    public function ptoLedger(?Policy $policy = null, ?CarbonImmutable $today = null): array
    {
        return Ledger::build(
            $policy ?? Policy::current(),
            $this->ptoStart(),
            (float) $this->pto_opening_hours,
            $this->leaves()->get(['date', 'days'])->map(fn (Leave $l) => ['date' => $l->date->toDateString(), 'days' => (float) $l->days]),
            $today ?? CarbonImmutable::today(),
        );
    }
}
