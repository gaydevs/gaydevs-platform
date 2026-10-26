<?php

namespace App\Exceptions;

use App\Support\RequestCorrelation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

abstract class OperationalException extends RuntimeException
{
    abstract protected function event(): string;

    /** @return array<string, mixed> */
    protected function context(): array
    {
        return [];
    }

    public function report(): bool
    {
        $request = request();
        Log::channel('operational')->error($this->event(), [
            'request_id' => RequestCorrelation::id($request),
            'method' => $request->method(),
            'path' => $request->path(),
            ...$this->context(),
            'exception' => $this,
        ]);

        return true;
    }

    public function render(Request $request): JsonResponse
    {
        $requestId = RequestCorrelation::id($request);

        return response()->json([
            'message' => 'Erro interno do servidor.',
            'reference' => $requestId,
        ], Response::HTTP_INTERNAL_SERVER_ERROR)->withHeaders([
            RequestCorrelation::HEADER => $requestId,
        ]);
    }
}
