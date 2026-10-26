<?php

use App\Exceptions\EmailRateLimitExceededException;
use App\Mail\LoginOtpMail;
use App\Services\EmailRateLimiter;
use App\Services\EmailSender;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

beforeEach(function () {
    Mail::fake();
});

afterEach(function () {
    RateLimiter::clear(EmailRateLimiter::KEY);
    RateLimiter::clear(EmailRateLimiter::DAILY_KEY);
});

test('email sender exposes a specific blocked exception and logs the global limit', function () {
    config([
        'rate_limits.global.email.max_attempts' => 1,
        'rate_limits.global.email.decay_seconds' => 3600,
        'rate_limits.global.email.daily.max_attempts' => 10,
        'rate_limits.global.email.daily.decay_seconds' => 86400,
    ]);
    $logPath = storage_path('logs/operational-email-rate-limit-'.Str::uuid().'.log');
    config([
        'logging.channels.operational' => [
            'driver' => 'single',
            'path' => $logPath,
            'level' => 'error',
            'replace_placeholders' => true,
        ],
    ]);
    Log::forgetChannel('operational');
    RateLimiter::hit(EmailRateLimiter::KEY, 3600);

    expect(fn () => app(EmailSender::class)->send(
        'user@example.test',
        new LoginOtpMail('123456'),
    ))->toThrow(EmailRateLimitExceededException::class);

    expect(file_get_contents($logPath))
        ->toContain('email.rate_limit_blocked')
        ->toContain('"scope":"global"')
        ->not->toContain('user@example.test')
        ->not->toContain('123456');
    Mail::assertNothingSent();
});

test('hourly email limit expires independently', function () {
    config([
        'rate_limits.global.email.max_attempts' => 1,
        'rate_limits.global.email.decay_seconds' => 3600,
        'rate_limits.global.email.daily.max_attempts' => 10,
        'rate_limits.global.email.daily.decay_seconds' => 86400,
    ]);
    $this->freezeTime();

    app(EmailSender::class)->send('first@example.test', new LoginOtpMail('123456'));

    expect(fn () => app(EmailSender::class)->send(
        'second@example.test',
        new LoginOtpMail('654321'),
    ))->toThrow(EmailRateLimitExceededException::class);

    $this->travel(3601)->seconds();
    app(EmailSender::class)->send('third@example.test', new LoginOtpMail('111111'));

    Mail::assertSent(LoginOtpMail::class, 2);
});

test('daily email limit expires independently', function () {
    config([
        'rate_limits.global.email.max_attempts' => 10,
        'rate_limits.global.email.decay_seconds' => 3600,
        'rate_limits.global.email.daily.max_attempts' => 1,
        'rate_limits.global.email.daily.decay_seconds' => 86400,
    ]);
    $this->freezeTime();

    app(EmailSender::class)->send('first@example.test', new LoginOtpMail('123456'));

    expect(fn () => app(EmailSender::class)->send(
        'second@example.test',
        new LoginOtpMail('654321'),
    ))->toThrow(EmailRateLimitExceededException::class);

    $this->travel(86401)->seconds();
    app(EmailSender::class)->send('third@example.test', new LoginOtpMail('111111'));

    Mail::assertSent(LoginOtpMail::class, 2);
});
