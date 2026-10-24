<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class UserNotActiveException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => 'Este membro não está ativo.',
            'reason' => 'user_not_active',
        ], Response::HTTP_FORBIDDEN);
    }
}
