<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Office-wide key/value settings (e.g. "pto.accrual_mode"). Read through get() so a missing
 * row falls back to the default from config/luna.php.
 *
 * @property string $key
 * @property string|null $value
 */
class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::query()->whereKey($key)->value('value') ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value === null ? null : (string) $value]);
    }
}
