<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CompanyChannel;
use App\Models\WipTile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * People -> Companies (admin): the client companies and their WIP item channels. Items point at a channel so
 * logged time is carried over to the right board; the tags also show as WIP tile tags on Home.
 */
class CompanyController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('people/companies', [
            'companies' => Company::query()->with('channels')->orderBy('tag')->get()->map(fn (Company $c) => [
                'id' => $c->id,
                'tag' => $c->tag,
                'name' => $c->name,
                'channels' => $c->channels->map(fn (CompanyChannel $ch) => $ch->only(['id', 'name', 'url'])),
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = Company::create(self::company($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$company->tag} added."]);

        return back();
    }

    public function update(Request $request, Company $company): RedirectResponse
    {
        $company->update(self::company($request, $company));
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$company->tag} saved."]);

        return back();
    }

    /** Its channels go with it; items on them stay, unlinked. */
    public function destroy(Company $company): RedirectResponse
    {
        $company->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$company->tag} removed."]);

        return back();
    }

    public function storeChannel(Request $request, Company $company): RedirectResponse
    {
        $company->channels()->create(self::channel($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => "Channel added to {$company->tag}."]);

        return back();
    }

    public function updateChannel(Request $request, CompanyChannel $channel): RedirectResponse
    {
        $channel->update(self::channel($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Channel saved.']);

        return back();
    }

    public function destroyChannel(CompanyChannel $channel): RedirectResponse
    {
        $channel->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Channel removed.']);

        return back();
    }

    /** @return array{tag: string, name: string} */
    private static function company(Request $request, ?Company $company = null): array
    {
        $request->merge(['tag' => strtoupper(trim((string) $request->input('tag')))]);

        return $request->validate([
            'tag' => ['required', 'string', 'max:4', 'regex:/^[A-Z0-9]+$/', Rule::unique('companies', 'tag')->ignore($company)],
            'name' => ['required', 'string', 'max:80'],
        ], ['tag.regex' => 'Letters and numbers only.', 'tag.max' => 'Up to 4 letters or numbers.']);
    }

    /** @return array{name: string, url: string} */
    private static function channel(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'url' => ['required', 'url', 'max:500', 'starts_with:'.WipTile::URL_PREFIX],
        ], ['url.starts_with' => 'Use a WIP link ('.WipTile::URL_PREFIX.'...).']);
    }
}
