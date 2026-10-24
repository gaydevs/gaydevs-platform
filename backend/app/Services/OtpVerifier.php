<?php

namespace App\Services;

use App\Data\OtpVerification;
use App\Enums\OtpAttemptResult;
use App\Enums\OtpRequestStatus;
use App\Models\AuthenticatedSession;
use App\Models\OtpAttempt;
use App\Models\OtpRequest;
use App\Models\VisitorObservation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class OtpVerifier
{
    private const TRANSACTION_ATTEMPTS = 3;

    public function verify(
        string $otpRequestId,
        string $code,
        ?string $ip,
        VisitorObservation $observation,
    ): OtpVerification {
        $rateLimitKey = 'otp-verify:ip:'.($ip ?? 'unknown');
        $rateLimit = (int) config('passwordless.rate_limits.verify_per_ip.max_attempts');
        $rateLimited = RateLimiter::tooManyAttempts($rateLimitKey, $rateLimit);

        if (! $rateLimited) {
            RateLimiter::hit(
                $rateLimitKey,
                (int) config('passwordless.rate_limits.verify_per_ip.decay_seconds'),
            );
        }

        return DB::transaction(function () use (
            $otpRequestId,
            $code,
            $observation,
            $rateLimited,
        ): OtpVerification {
            $otpRequest = OtpRequest::query()
                ->with('user')
                ->lockForUpdate()
                ->find($otpRequestId);

            if ($otpRequest === null) {
                return new OtpVerification(
                    $rateLimited ? OtpAttemptResult::RateLimited : OtpAttemptResult::InvalidCode,
                );
            }

            if ($rateLimited) {
                return $this->record($otpRequest, $observation, OtpAttemptResult::RateLimited);
            }

            if ($otpRequest->status === OtpRequestStatus::Used) {
                $matchesCode = $otpRequest->matchesCode($code);

                return $this->record(
                    $otpRequest,
                    $observation,
                    $matchesCode
                        ? OtpAttemptResult::AlreadyUsed
                        : OtpAttemptResult::InvalidCode,
                    authenticatedUser: $matchesCode,
                );
            }

            if ($otpRequest->status === OtpRequestStatus::Superseded) {
                $matchesCode = $otpRequest->matchesCode($code);

                return $this->record(
                    $otpRequest,
                    $observation,
                    $matchesCode
                        ? OtpAttemptResult::Superseded
                        : OtpAttemptResult::InvalidCode,
                    authenticatedUser: $matchesCode,
                );
            }

            if ($otpRequest->status === OtpRequestStatus::Expired || $otpRequest->expires_at->isPast()) {
                if ($otpRequest->status !== OtpRequestStatus::Expired) {
                    $otpRequest->update(['status' => OtpRequestStatus::Expired]);
                }

                return $this->record($otpRequest, $observation, OtpAttemptResult::Expired);
            }

            if ($otpRequest->status === OtpRequestStatus::Locked) {
                return $this->record($otpRequest, $observation, OtpAttemptResult::Locked);
            }

            if ($otpRequest->user->status !== $otpRequest->user::STATUS_ACTIVE) {
                $otpRequest->update(['status' => OtpRequestStatus::Locked]);

                return $this->record($otpRequest, $observation, OtpAttemptResult::Locked);
            }

            if ($otpRequest->matchesCode($code)) {
                $acceptedAt = now();
                $authenticatedSession = AuthenticatedSession::query()->create([
                    'user_id' => $otpRequest->user_id,
                    'authenticated_at' => $acceptedAt,
                    'last_seen_at' => $acceptedAt,
                ]);
                $otpRequest->update([
                    'status' => OtpRequestStatus::Used,
                    'accepted_at' => $acceptedAt,
                ]);

                return $this->record(
                    $otpRequest,
                    $observation,
                    OtpAttemptResult::Accepted,
                    authenticatedUser: true,
                    authenticatedSession: $authenticatedSession,
                );
            }

            $supersededRequest = $this->matchingSupersededRequest($otpRequest, $code);
            if ($supersededRequest !== null) {
                return $this->record(
                    $otpRequest,
                    $observation,
                    OtpAttemptResult::Superseded,
                    matchedOtpRequest: $supersededRequest,
                    authenticatedUser: true,
                );
            }

            $failedAttempts = $otpRequest->failed_attempts + 1;
            $locked = $failedAttempts >= (int) config('passwordless.otp.max_verification_attempts');
            $otpRequest->update([
                'failed_attempts' => $failedAttempts,
                'status' => $locked ? OtpRequestStatus::Locked : OtpRequestStatus::Pending,
            ]);

            return $this->record(
                $otpRequest,
                $observation,
                $locked ? OtpAttemptResult::Locked : OtpAttemptResult::InvalidCode,
            );
        }, self::TRANSACTION_ATTEMPTS);
    }

    private function matchingSupersededRequest(OtpRequest $currentRequest, string $code): ?OtpRequest
    {
        return OtpRequest::query()
            ->where('user_id', $currentRequest->user_id)
            ->where('status', OtpRequestStatus::Superseded->value)
            ->latest('created_at')
            ->limit((int) config('passwordless.otp.superseded_code_lookup_limit'))
            ->get()
            ->first(fn (OtpRequest $request): bool => $request->matchesCode($code));
    }

    private function record(
        OtpRequest $otpRequest,
        VisitorObservation $observation,
        OtpAttemptResult $result,
        ?OtpRequest $matchedOtpRequest = null,
        bool $authenticatedUser = false,
        ?AuthenticatedSession $authenticatedSession = null,
    ): OtpVerification {
        OtpAttempt::query()->create([
            'otp_request_id' => $otpRequest->id,
            'matched_otp_request_id' => $matchedOtpRequest?->id,
            'visitor_observation_id' => $observation->id,
            'authenticated_user_id' => $authenticatedUser ? $otpRequest->user_id : null,
            'result' => $result,
            'attempted_at' => now(),
        ]);

        return new OtpVerification(
            $result,
            $authenticatedUser ? $otpRequest->user : null,
            $authenticatedSession,
        );
    }
}
