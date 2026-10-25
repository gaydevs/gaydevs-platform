<?php

namespace App\Services;

use App\Models\AuthenticatedSession;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class AuthenticatedSessionManager
{
    public function establish(Request $request, User $user, AuthenticatedSession $authenticatedSession): void
    {
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put(AuthenticatedSession::SESSION_KEY, $authenticatedSession->id);
    }

    public function expireStale(): int
    {
        $expiredAt = now();

        return AuthenticatedSession::query()
            ->whereNull('ended_at')
            ->where('last_seen_at', '<', $expiredAt->copy()->subMinutes(
                (int) config('session.lifetime'),
            ))
            ->update([
                'ended_at' => $expiredAt,
                'end_reason' => 'expired',
                'updated_at' => $expiredAt,
            ]);
    }

    public function logout(Request $request): void
    {
        $this->ensureStateful($request);

        $authenticatedSession = $this->current($request);
        $this->attributeObservation($request, authenticatedSession: $authenticatedSession);
        $authenticatedSession?->update([
            'ended_at' => now(),
            'end_reason' => 'logout',
        ]);

        $this->invalidateWebSession($request);
    }

    public function logoutAll(Request $request): void
    {
        $this->ensureStateful($request);

        $user = $request->user();
        if (! $user instanceof User) {
            return;
        }

        $authenticatedSession = $this->current($request);
        $this->attributeObservation($request, authenticatedSession: $authenticatedSession);
        $this->endAllWebSessions($user, 'logout_all');

        $this->invalidateWebSession($request);
    }

    public function terminateForInactiveUser(Request $request, User $user): void
    {
        $authenticatedSession = $this->current($request);
        $this->attributeObservation($request, authenticatedSession: $authenticatedSession);
        $this->endAllWebSessions($user, 'user_not_active');

        if ($request->hasSession()) {
            $this->invalidateWebSession($request);
        } else {
            Auth::forgetGuards();
        }
    }

    private function endAllWebSessions(User $user, string $reason): void
    {
        $endedAt = now();

        DB::transaction(function () use ($user, $reason, $endedAt): void {
            AuthenticatedSession::query()
                ->where('user_id', $user->id)
                ->whereNull('ended_at')
                ->update([
                    'ended_at' => $endedAt,
                    'end_reason' => $reason,
                    'updated_at' => $endedAt,
                ]);

            DB::table((string) config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->delete();
        });
    }

    private function current(Request $request): ?AuthenticatedSession
    {
        if (! $request->hasSession()) {
            return null;
        }

        $id = $request->session()->get(AuthenticatedSession::SESSION_KEY);
        if (! is_int($id) && ! ctype_digit((string) $id)) {
            return null;
        }

        return AuthenticatedSession::query()
            ->whereKey((int) $id)
            ->where('user_id', $request->user()?->getAuthIdentifier())
            ->whereNull('ended_at')
            ->first();
    }

    private function invalidateWebSession(Request $request): void
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        Auth::forgetGuards();
    }

    private function ensureStateful(Request $request): void
    {
        if (! $request->hasSession()
            || $request->user()?->currentAccessToken() instanceof PersonalAccessToken) {
            throw new AuthenticationException;
        }
    }

    private function attributeObservation(
        Request $request,
        ?AuthenticatedSession $authenticatedSession = null,
    ): void {
        $observation = $request->attributes->get('visitor_observation');
        if (! $observation instanceof VisitorObservation) {
            return;
        }

        if ($authenticatedSession !== null) {
            $observation->authenticatedSession()->associate($authenticatedSession);
        }
        $observation->save();
    }
}
