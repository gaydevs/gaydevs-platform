<?php

namespace App\Http\Middleware;

use App\Enums\MemberType;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->user()?->getAuthIdentifier();
        $user = $id ? User::query()->find($id) : null;
        abort_unless($user?->status === User::STATUS_ACTIVE && $user->member_type === MemberType::ADMIN, 403);

        return $next($request);
    }
}
