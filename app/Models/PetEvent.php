<?php

namespace App\Models;

use App\Services\Moonlings;
use Illuminate\Database\Eloquent\Model;

/**
 * One XP award to someone's pet (App\Services\Pet). `ref` makes it once-only: the office date for a visit,
 * `{item_id}:{office date}` for item time, the first leave date, the payslip id. The XP goes to the moonling that
 * was active when it was given (slice 6): set here when not given, as Pet::award does.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $moonling_id
 * @property string $kind visit|item_time|leave|payslip|duel|pat
 * @property string $ref
 * @property int $xp
 */
class PetEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'moonling_id', 'kind', 'ref', 'xp'];

    protected static function booted(): void
    {
        static::creating(function (PetEvent $event) {
            $event->moonling_id ??= Moonlings::active(User::query()->findOrFail($event->user_id))->id;
        });
    }
}
