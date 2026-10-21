<?php

namespace App\Http\Middleware;

use App\Models\AuthenticatedSession;
use App\Models\VisitorObservation;
use App\Services\VisitorIdentifier;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class TrackVisitor
{
    public function __construct(private readonly VisitorIdentifier $visitors) {}

    public function handle(Request $request, Closure $next): Response
    {
        $observation = $this->visitors->identify($request);
        try {
            $response = $next($request);
        } finally {
            $this->attributeAuthentication($request, $observation);
        }

        $response->headers->setCookie(Cookie::create(
            VisitorIdentifier::VISITOR_COOKIE,
            Crypt::encryptString($observation->visit->visitor_id),
            now()->addYears((int) config('visitors.cookie_lifetime_years')),
            config('session.path', '/'),
            config('session.domain'),
            (bool) config('session.secure', false),
            true,
            false,
            config('session.same_site', 'lax'),
        ));

        return $response;
    }

    private function attributeAuthentication(Request $request, VisitorObservation $observation): void
    {
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $observation->personalAccessToken()->associate($token);
            $observation->save();

            return;
        }

        if (! $request->hasSession()) {
            return;
        }

        $authenticatedSessionId = $request->session()->get(AuthenticatedSession::SESSION_KEY);
        if (! is_int($authenticatedSessionId) && ! ctype_digit((string) $authenticatedSessionId)) {
            return;
        }

        $authenticatedSession = AuthenticatedSession::query()
            ->whereKey((int) $authenticatedSessionId)
            ->whereNull('ended_at')
            ->first();
        $user = $request->user();

        if ($authenticatedSession === null
            || $user === null
            || (string) $authenticatedSession->user_id !== (string) $user->getAuthIdentifier()) {
            return;
        }

        $observation->authenticatedSession()->associate($authenticatedSession);
        $observation->save();
        $authenticatedSession->update(['last_seen_at' => now()]);
    }
}
