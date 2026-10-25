<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RequestCorrelation
{
    public const ATTRIBUTE = 'request_id';

    public const HEADER = 'X-Request-ID';

    public static function id(Request $request): string
    {
        $requestId = $request->attributes->get(self::ATTRIBUTE);
        if (is_string($requestId) && Str::isUuid($requestId)) {
            return $requestId;
        }

        $requestId = (string) Str::uuid7();
        $request->attributes->set(self::ATTRIBUTE, $requestId);

        return $requestId;
    }
}
