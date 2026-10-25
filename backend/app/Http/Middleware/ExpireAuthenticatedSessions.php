<?php

namespace App\Http\Middleware;

use App\Services\AuthenticatedSessionManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ExpireAuthenticatedSessions
{
    public function __construct(private readonly AuthenticatedSessionManager $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->sessions->expireStale();

        return $next($request);
    }
}
