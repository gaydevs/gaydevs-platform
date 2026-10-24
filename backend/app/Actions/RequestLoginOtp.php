<?php

namespace App\Actions;

use App\Exceptions\RateLimitExceededException;
use App\Exceptions\UserNotActiveException;
use App\Exceptions\UserNotFoundException;
use App\Mail\LoginOtpMail;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\EmailSender;
use App\Services\OtpIssuer;
use App\Support\RequestCorrelation;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class RequestLoginOtp
{
    public function __construct(
        private readonly OtpIssuer $issuer,
        private readonly EmailSender $emails,
    ) {}

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
        $limits = [
            [
                'key' => $userKey,
                'config' => 'request_per_user',
            ],
            [
                'key' => $ipKey,
                'config' => 'request_per_ip',
            ],
            [
                'key' => 'otp-request:global',
                'config' => 'request_global',
            ],
        ];

        foreach ($limits as $limit) {
            $maxAttempts = (int) config(
                'passwordless.rate_limits.'.$limit['config'].'.max_attempts',
            );

            if (RateLimiter::tooManyAttempts($limit['key'], $maxAttempts)) {
                if ($limit['config'] === 'request_global') {
                    $this->logGlobalRateLimitBlocked($limit);
                }

                throw new RateLimitExceededException;
            }
        }

        $this->emails->ensureCapacity();

        foreach ($limits as $limit) {
            $decaySeconds = (int) config(
                'passwordless.rate_limits.'.$limit['config'].'.decay_seconds',
            );

            if ($limit['config'] !== 'request_global') {
                RateLimiter::hit($limit['key'], $decaySeconds);

                continue;
            }

            $attempts = RateLimiter::hit($limit['key'], $decaySeconds);

            if ($attempts > (int) config(
                'passwordless.rate_limits.'.$limit['config'].'.max_attempts',
            )) {
                $this->logGlobalRateLimitBlocked($limit);
                throw new RateLimitExceededException;
            }
        }

        $this->emails->reserve();
        $issued = $this->issuer->issue($user, $observation);
        $this->emails->sendReserved($user->email, new LoginOtpMail($issued->code));

        return $issued->request;
    }

    /** @param array{key: string, config: string} $limit */
    private function logGlobalRateLimitBlocked(array $limit): void
    {
        Log::channel('operational')->error('otp.rate_limit_blocked', [
            'request_id' => RequestCorrelation::id(request()),
            'scope' => 'global',
            'max_attempts' => (int) config(
                'passwordless.rate_limits.'.$limit['config'].'.max_attempts',
            ),
            'decay_seconds' => (int) config(
                'passwordless.rate_limits.'.$limit['config'].'.decay_seconds',
            ),
        ]);
    }
}
