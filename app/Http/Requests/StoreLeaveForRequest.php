<?php

namespace App\Http\Requests;

use App\Models\User;

/**
 * HR logging leave for someone else (route `people.leave.store`, `can:hr`): the same rules as
 * StoreLeaveRequest, except cut-offs that have ended are open, so missed leave can be recorded.
 */
class StoreLeaveForRequest extends StoreLeaveRequest
{
    public function owner(): User
    {
        /** @var User */
        return $this->route('user');
    }

    protected function allowsEndedCutOffs(): bool
    {
        return true;
    }
}
