<?php

namespace App\Http\Requests;

use App\Models\WipTile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Pinning or editing one of your own WIP tiles: a tag (OCS, QSS or 1-4 letters/digits), a name, an optional
 * short description and a WIP link. A new tile past WipTile::MAX is refused; editing one at the cap is fine.
 */
class WipTileRequest extends FormRequest
{
    /** Only the owner edits a tile (checked before validation, so nobody learns anything from errors). */
    public function authorize(): bool
    {
        $tile = $this->route('tile');

        return $tile === null || $tile->user_id === $this->user()->id;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'tag' => strtoupper(trim((string) $this->input('tag'))),
            'name' => trim((string) $this->input('name')),
            'about' => trim((string) $this->input('about')) ?: null,
            'url' => trim((string) $this->input('url')),
        ]);
    }

    public function rules(): array
    {
        return [
            'tag' => ['required', 'string', 'max:4', 'regex:/^[A-Z0-9]+$/'],
            'name' => ['required', 'string', 'max:40'],
            'about' => ['nullable', 'string', 'max:80'],
            'url' => ['required', 'string', 'max:500', 'url:https', 'starts_with:'.WipTile::URL_PREFIX],
        ];
    }

    public function messages(): array
    {
        return [
            'tag.regex' => 'Letters and numbers only.',
            'url.url' => 'Paste the full WIP link (https://wip.quicksilversystems.com/…).',
            'url.starts_with' => 'Only WIP links: https://wip.quicksilversystems.com/…',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $v) {
                if ($this->route('tile') === null && $this->user()->wipTiles()->count() >= WipTile::MAX) {
                    $v->errors()->add('tiles', 'You can pin up to '.WipTile::MAX.' channels. Remove one first.');
                }
            },
        ];
    }

    /** @return array{tag: string, name: string, about: string|null, url: string} */
    public function tile(): array
    {
        return $this->safe()->only(['tag', 'name', 'about', 'url']);
    }
}
