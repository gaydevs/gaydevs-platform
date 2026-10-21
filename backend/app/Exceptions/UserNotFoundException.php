<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class UserNotFoundException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => 'Membro não encontrado.',
            'reason' => 'user_not_found',
        ], Response::HTTP_NOT_FOUND);
    }
}
