<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitPollResponseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'added_options' => ['present', 'array'],
            'added_options.*' => ['required', 'uuid', 'distinct'],
            'removed_options' => ['present', 'array'],
            'removed_options.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
