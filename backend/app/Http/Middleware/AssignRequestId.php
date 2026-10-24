<?php

namespace App\Http\Middleware;

use App\Support\RequestCorrelation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = RequestCorrelation::id($request);
        Log::withContext(['request_id' => $requestId]);

        $response = $next($request);
        $response->headers->set(RequestCorrelation::HEADER, $requestId);

        return $response;
    }
}
