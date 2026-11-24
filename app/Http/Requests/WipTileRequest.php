<?php

namespace App\Http\Requests;

use App\Models\WipTile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Pinning or editing one of your own Home tiles: a WIP channel or any web link (kind, fixed once pinned), a
 * tag (OCS, QSS or 1-4 letters/digits), a name, an optional short description and the link. A WIP channel
 * must open WIP; a link may be any http(s) address. A new tile past WipTile::MAX of its kind is refused;
 * editing one at the cap is fine.
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
            // An edit keeps its tile's kind, so a link can't turn into a WIP tile and skip the WIP check.
            'kind' => $this->route('tile')?->kind ?? ((string) $this->input('kind') ?: 'wip'),
            'tag' => strtoupper(trim((string) $this->input('tag'))),
            'name' => trim((string) $this->input('name')),
            'about' => trim((string) $this->input('about')) ?: null,
            'url' => trim((string) $this->input('url')),
        ]);
    }

    public function rules(): array
    {
        $url = $this->input('kind') === 'link'
            ? ['url:http,https']
            : ['url:https', 'starts_with:'.WipTile::URL_PREFIX];

        return [
            'kind' => ['required', Rule::in(WipTile::KINDS)],
            'tag' => ['required', 'string', 'max:4', 'regex:/^[A-Z0-9]+$/'],
            'name' => ['required', 'string', 'max:40'],
            'about' => ['nullable', 'string', 'max:80'],
            'url' => ['required', 'string', 'max:500', ...$url],
        ];
    }

    public function messages(): array
    {
        return $this->input('kind') === 'link'
            ? ['tag.regex' => 'Letters and numbers only.', 'url.url' => 'Paste the full link, starting with https://']
            : [
                'tag.regex' => 'Letters and numbers only.',
                'url.url' => 'Paste the full WIP link (https://wip.quicksilversystems.com/…).',
                'url.starts_with' => 'Only WIP links: https://wip.quicksilversystems.com/…',
            ];
    }

    public function after(): array
    {
        return [
            function (Validator $v) {
                $kind = $this->input('kind');
                if ($this->route('tile') === null && in_array($kind, WipTile::KINDS, true)
                    && $this->user()->wipTiles()->where('kind', $kind)->count() >= WipTile::MAX) {
                    $what = $kind === 'link' ? 'links' : 'channels';
                    $v->errors()->add('tiles', 'You can pin up to '.WipTile::MAX." $what. Remove one first.");
                }
            },
        ];
    }

    /** @return array{kind: string, tag: string, name: string, about: string|null, url: string} */
    public function tile(): array
    {
        return $this->safe()->only(['kind', 'tag', 'name', 'about', 'url']);
    }
}
