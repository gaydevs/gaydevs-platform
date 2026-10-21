<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SearchUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => [
                'nullable',
                'string',
                'max:'.(int) config('passwordless.search.query_max_characters'),
            ],
        ];
    }
}
