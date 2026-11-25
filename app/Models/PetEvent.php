<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One XP award to someone's pet (App\Services\Pet). `ref` makes it once-only: the office date for a visit,
 * `{item_id}:{office date}` for item time, the first leave date, the payslip id.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind visit|item_time|leave|payslip
 * @property string $ref
 * @property int $xp
 */
class PetEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'kind', 'ref', 'xp'];
}
