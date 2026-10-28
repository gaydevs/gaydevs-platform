<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DismissPollSuggestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'poll_id' => ['required', 'uuid', 'exists:polls,id'],
        ];
    }
}
