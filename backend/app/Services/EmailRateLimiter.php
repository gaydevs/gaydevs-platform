<?php

namespace App\Services;

use App\Exceptions\EmailRateLimitExceededException;
use App\Support\RequestCorrelation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class EmailRateLimiter
{
    public const KEY = 'email-send:global';

    public function assertAvailable(): void
    {
        $limit = $this->limit();

        if (! RateLimiter::tooManyAttempts(self::KEY, $limit['max_attempts'])) {
            return;
        }

        $this->logBlocked($limit);
        throw new EmailRateLimitExceededException;
    }

    public function reserve(): void
    {
        $limit = $this->limit();
        $attempts = RateLimiter::hit(self::KEY, $limit['decay_seconds']);

        if ($attempts <= $limit['max_attempts']) {
            return;
        }

        $this->logBlocked($limit);
        throw new EmailRateLimitExceededException;
    }

    /** @param array{max_attempts: int, decay_seconds: int} $limit */
    private function logBlocked(array $limit): void
    {
        Log::channel('operational')->error('email.rate_limit_blocked', [
            'request_id' => $this->requestId(),
            'scope' => 'global',
            'max_attempts' => $limit['max_attempts'],
            'decay_seconds' => $limit['decay_seconds'],
        ]);
    }

    /** @return array{max_attempts: int, decay_seconds: int} */
    private function limit(): array
    {
        return [
            'max_attempts' => (int) config('rate_limits.global.email.max_attempts'),
            'decay_seconds' => (int) config('rate_limits.global.email.decay_seconds'),
        ];
    }

    private function requestId(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }

        $request = app('request');

        return $request instanceof Request ? RequestCorrelation::id($request) : null;
    }
}
