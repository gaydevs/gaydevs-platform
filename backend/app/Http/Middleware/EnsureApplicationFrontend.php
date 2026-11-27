<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class EnsureApplicationFrontend
{
    public function handle(Request $request, Closure $next): Response
    {
        // Sanctum's first-party pipeline starts the session and validates CSRF.
        if (! $request->attributes->get('sanctum') || ! $request->hasSession()) {
            throw new HttpException(401, 'Sessão segura necessária.');
        }

        return $next($request);
    }
}
