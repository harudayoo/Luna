<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A moon duel (App\Services\PetDuels): the challenger picks, the opponent answers later. The challenger's pick
 * is never sent to the opponent's page while the duel is open.
 *
 * @property int $id
 * @property int $challenger_id
 * @property int $opponent_id
 * @property string $challenger_pick moon|star|comet
 * @property string|null $opponent_pick
 * @property int|null $winner_id null on a draw, or while not answered
 * @property string $status open|done|declined|expired
 * @property Carbon|null $answered_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PetDuel extends Model
{
    protected $fillable = ['challenger_id', 'opponent_id', 'challenger_pick', 'opponent_pick', 'winner_id', 'status', 'answered_at'];

    protected function casts(): array
    {
        return ['answered_at' => 'datetime'];
    }

    public function challenger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'challenger_id');
    }

    public function opponent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opponent_id');
    }
}
