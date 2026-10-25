<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class RateLimitExceededException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(
            ['message' => 'Muitas tentativas. Tente novamente mais tarde.'],
            Response::HTTP_TOO_MANY_REQUESTS,
        );
    }
}
