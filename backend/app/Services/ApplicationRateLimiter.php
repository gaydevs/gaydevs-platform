<?php

namespace App\Services;

use App\Exceptions\RateLimitExceededException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

class ApplicationRateLimiter
{
    public function request(?string $ip): void
    {
        $this->reserve([[$this->key('request-ip', $ip ?? 'unknown'), $this->limit('ip_hour'), 3600]]);
    }

    public function verify(?string $ip): void
    {
        $this->reserve([[$this->key('verify-ip', $ip ?? 'unknown'), $this->limit('verify_ip_hour'), 3600]]);
    }

    public function links(?string $ip): void
    {
        $this->reserve([[$this->key('links-ip', $ip ?? 'unknown'), $this->limit('verify_ip_hour'), 3600]]);
    }

    public function sendOtp(string $email): void
    {
        $this->reserve([
            [$this->key('cooldown', $email), 1, $this->limit('cooldown')],
            [$this->key('email', $email), $this->limit('email_hour'), 3600],
            ['application:otp-day', $this->limit('otp_day'), 86400],
        ]);
    }

    public function mail(): void
    {
        $global = (int) config('rate_limits.global.email.daily.max_attempts');
        $hourly = (int) config('rate_limits.global.email.max_attempts');
        $this->reserve([
            ['application:mail-day', min($this->limit('mail_day'), intdiv($global, 2)), 86400],
            ['application:mail-hour', intdiv($hourly, 2), 3600],
        ]);
        // Keep the existing transport-wide reservation mandatory.
        app(EmailRateLimiter::class)->reserve(application: true);
    }

    private function limit(string $name): int
    {
        return (int) config('applications.limits.'.$name);
    }

    private function key(string $scope, string $value): string
    {
        return 'application:'.$scope.':'.hash_hmac('sha256', $value, (string) config('app.key'));
    }

    private function reserve(array $limits): void
    {
        Cache::lock('application:rate-limit-lock', 15)->block(5, function () use ($limits): void {
            foreach ($limits as [$key, $maximum, $seconds]) {
                if ($maximum <= 0 || $seconds <= 0 || RateLimiter::tooManyAttempts($key, $maximum)) {
                    throw new RateLimitExceededException;
                }
            }
            foreach ($limits as [$key, $maximum, $seconds]) {
                RateLimiter::hit($key, $seconds);
            }
        });
    }
}
