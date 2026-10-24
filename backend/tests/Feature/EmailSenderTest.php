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
});

test('email sender exposes a specific blocked exception and logs the global limit', function () {
    config([
        'passwordless.rate_limits.email_global.max_attempts' => 1,
        'passwordless.rate_limits.email_global.decay_seconds' => 3600,
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
