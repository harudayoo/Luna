<?php

namespace App\Http\Requests;

use App\Models\Holiday;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Adding or editing a holiday (HR). One per date; weekends are allowed (Nov 1 can be a Sunday).
 * `cancel_leave` also cancels any leave logged on the date; otherwise that leave is kept, uncharged.
 */
class HolidayRequest extends FormRequest
{
    public function rules(): array
    {
        /** @var Holiday|null $holiday */
        $holiday = $this->route('holiday');

        return [
            'date' => ['required', 'date_format:Y-m-d', Rule::unique('holidays', 'date')->ignore($holiday?->id)],
            'name' => ['required', 'string', 'max:80'],
            'kind' => ['required', Rule::in(Holiday::KINDS)],
            'cancel_leave' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['date.unique' => 'There is already a holiday on that date.'];
    }
}
