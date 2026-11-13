<?php

namespace App\Http\Controllers;

use App\Http\Requests\WipTileRequest;
use App\Models\WipTile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The WIP channels people pin on their own Home (under the office's tiles). Each person manages only theirs.
 */
class WipTileController extends Controller
{
    public function store(WipTileRequest $request): RedirectResponse
    {
        $tile = $request->user()->wipTiles()->create($request->tile());
        Inertia::flash('toast', ['type' => 'success', 'message' => "#{$tile->name} pinned."]);

        return back();
    }

    /** Owner-only: WipTileRequest::authorize. */
    public function update(WipTileRequest $request, WipTile $tile): RedirectResponse
    {
        $tile->update($request->tile());
        Inertia::flash('toast', ['type' => 'success', 'message' => "#{$tile->name} saved."]);

        return back();
    }

    public function destroy(Request $request, WipTile $tile): RedirectResponse
    {
        abort_unless($tile->user_id === $request->user()->id, 403);

        $tile->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => "#{$tile->name} unpinned."]);

        return back();
    }
}
