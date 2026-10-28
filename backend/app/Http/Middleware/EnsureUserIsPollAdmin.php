<?php

namespace App\Http\Middleware;

use App\Enums\MemberType;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsPollAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user() instanceof User && $request->user()->member_type === MemberType::ADMIN, 403);

        return $next($request);
    }
}
