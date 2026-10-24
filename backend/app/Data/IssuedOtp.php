<?php

namespace App\Data;

use App\Models\OtpRequest;

readonly class IssuedOtp
{
    public function __construct(
        public OtpRequest $request,
        public string $code,
    ) {}
}
