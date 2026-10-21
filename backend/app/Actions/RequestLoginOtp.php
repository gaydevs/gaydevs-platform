<?php

namespace App\Actions;

use App\Exceptions\RateLimitExceededException;
use App\Exceptions\UserNotActiveException;
use App\Exceptions\UserNotFoundException;
use App\Mail\LoginOtpMail;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\OtpIssuer;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class RequestLoginOtp
{
    public function __construct(private readonly OtpIssuer $issuer) {}

    public function handle(string $userId, ?string $ip, VisitorObservation $observation): OtpRequest
    {
        $user = User::query()->find($userId);

        if ($user === null) {
            throw new UserNotFoundException;
        }

        if ($user->status !== User::STATUS_ACTIVE) {
            throw new UserNotActiveException;
        }

        $userKey = 'otp-request:user:'.$user->id;
        $ipKey = 'otp-request:ip:'.($ip ?? 'unknown');
        $userLimit = (int) config('passwordless.rate_limits.request_per_user.max_attempts');
        $ipLimit = (int) config('passwordless.rate_limits.request_per_ip.max_attempts');
        if (RateLimiter::tooManyAttempts($userKey, $userLimit)
            || RateLimiter::tooManyAttempts($ipKey, $ipLimit)) {
            throw new RateLimitExceededException;
        }

        RateLimiter::hit(
            $userKey,
            (int) config('passwordless.rate_limits.request_per_user.decay_seconds'),
        );
        RateLimiter::hit(
            $ipKey,
            (int) config('passwordless.rate_limits.request_per_ip.decay_seconds'),
        );

        $issued = $this->issuer->issue($user, $observation);
        Mail::to($user->email)->send(new LoginOtpMail($issued->code));

        return $issued->request;
    }
}
