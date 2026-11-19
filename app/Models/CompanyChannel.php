<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One of a company's WIP item channels (its board), e.g. SSI · Equine Items. Items point at one, so logged time
 * can be carried over to the right board.
 *
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property string $url a WIP link
 */
class CompanyChannel extends Model
{
    protected $fillable = ['name', 'url'];

    /** "SSI · Equine Items" */
    public function label(): string
    {
        return "{$this->company->tag} · {$this->name}";
    }

    /** @return array{id: int, label: string, url: string} */
    public function toChannel(): array
    {
        return ['id' => $this->id, 'label' => $this->label(), 'url' => $this->url];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
