<?php

use App\Services\EmailRateLimiter;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

uses(TestCase::class);

test('email reservation rolls back an earlier counter when a later hit fails', function () {
    config([
        'rate_limits.global.email.max_attempts' => 10,
        'rate_limits.global.email.decay_seconds' => 3600,
        'rate_limits.global.email.daily.max_attempts' => 10,
        'rate_limits.global.email.daily.decay_seconds' => 86400,
    ]);

    RateLimiter::shouldReceive('tooManyAttempts')
        ->twice()
        ->andReturnFalse();
    RateLimiter::shouldReceive('hit')
        ->once()
        ->with(EmailRateLimiter::HOURLY_KEY, 3600)
        ->andReturn(1);
    RateLimiter::shouldReceive('hit')
        ->once()
        ->with(EmailRateLimiter::DAILY_KEY, 86400)
        ->andThrow(new RuntimeException('simulated counter failure'));
    RateLimiter::shouldReceive('decrement')
        ->once()
        ->with(EmailRateLimiter::HOURLY_KEY, 3600)
        ->andReturn(0);

    expect(fn () => app(EmailRateLimiter::class)->reserve())
        ->toThrow(RuntimeException::class, 'simulated counter failure');
});
