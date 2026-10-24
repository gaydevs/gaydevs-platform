<?php

namespace App\Http\Middleware;

use App\Exceptions\UserNotActiveException;
use App\Models\User;
use App\Services\AuthenticatedSessionManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function __construct(private readonly AuthenticatedSessionManager $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        $currentStatus = $user instanceof User
            ? User::query()->whereKey($user->getAuthIdentifier())->value('status')
            : null;

        if ($user instanceof User && $currentStatus !== User::STATUS_ACTIVE) {
            $this->sessions->terminateForInactiveUser($request, $user);

            throw new UserNotActiveException;
        }

        return $next($request);
    }
}
