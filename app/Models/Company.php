<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A client company. Its tag (1-4 letters/digits, e.g. SSI) is how the office names it, and doubles as a WIP
 * tile tag on Home. Admin keeps the list (People -> Companies).
 *
 * @property int $id
 * @property string $tag
 * @property string $name
 */
class Company extends Model
{
    protected $fillable = ['tag', 'name'];

    /** @return HasMany<CompanyChannel, $this> */
    public function channels(): HasMany
    {
        return $this->hasMany(CompanyChannel::class)->orderBy('id');
    }
}
