<?php

namespace App\Services;

use App\Exceptions\EmailRateLimitExceededException;
use App\Support\RequestCorrelation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

class EmailRateLimiter
{
    public const HOURLY_KEY = 'email-send:global:hourly';

    public const DAILY_KEY = 'email-send:global:daily';

    public const KEY = self::HOURLY_KEY;

    private const LOCK_KEY = 'email-send:global:lock';

    public function assertAvailable(): void
    {
        $this->withLock(function (): void {
            foreach ($this->limits() as $window => $limit) {
                if (! RateLimiter::tooManyAttempts($limit['key'], $limit['max_attempts'])) {
                    continue;
                }

                $this->logBlocked($window, $limit);
                throw new EmailRateLimitExceededException;
            }
        });
    }

    public function reserve(): void
    {
        $this->withLock(function (): void {
            foreach ($this->limits() as $window => $limit) {
                if (! RateLimiter::tooManyAttempts($limit['key'], $limit['max_attempts'])) {
                    continue;
                }

                $this->logBlocked($window, $limit);
                throw new EmailRateLimitExceededException;
            }

            $reserved = [];

            try {
                foreach ($this->limits() as $limit) {
                    RateLimiter::hit($limit['key'], $limit['decay_seconds']);
                    $reserved[] = $limit;
                }
            } catch (Throwable $exception) {
                foreach ($reserved as $limit) {
                    RateLimiter::decrement($limit['key'], $limit['decay_seconds']);
                }

                throw $exception;
            }
        });
    }

    /** @param array{key: string, max_attempts: int, decay_seconds: int} $limit */
    private function logBlocked(string $window, array $limit): void
    {
        Log::channel('operational')->error('email.rate_limit_blocked', [
            'request_id' => $this->requestId(),
            'scope' => 'global',
            'window' => $window,
            'max_attempts' => $limit['max_attempts'],
            'decay_seconds' => $limit['decay_seconds'],
        ]);
    }

    /** @return array<string, array{key: string, max_attempts: int, decay_seconds: int}> */
    private function limits(): array
    {
        return [
            'hourly' => [
                'key' => self::HOURLY_KEY,
                'max_attempts' => (int) config('rate_limits.global.email.max_attempts'),
                'decay_seconds' => (int) config('rate_limits.global.email.decay_seconds'),
            ],
            'daily' => [
                'key' => self::DAILY_KEY,
                'max_attempts' => (int) config('rate_limits.global.email.daily.max_attempts'),
                'decay_seconds' => (int) config('rate_limits.global.email.daily.decay_seconds'),
            ],
        ];
    }

    private function withLock(Closure $callback): void
    {
        Cache::lock(self::LOCK_KEY, 10)->block(5, $callback);
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
