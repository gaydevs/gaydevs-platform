<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifyOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'otp_request_id' => ['required', 'uuid'],
            'code' => ['required', 'digits:'.(int) config('passwordless.otp.digits')],
        ];
    }
}
