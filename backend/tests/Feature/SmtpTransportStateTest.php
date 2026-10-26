<?php

use App\Exceptions\EmailRateLimitExceededException;
use App\Mail\LoginOtpMail;
use App\Models\SmtpTransportState;
use App\Services\EmailRateLimiter;
use App\Services\EmailSender;
use App\Services\SmtpTransportStateStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear(EmailRateLimiter::KEY);
    RateLimiter::clear(EmailRateLimiter::DAILY_KEY);
    config([
        'mail.default' => 'smtp',
        'rate_limits.global.email.max_attempts' => 10,
        'rate_limits.global.email.decay_seconds' => 3600,
        'rate_limits.global.email.daily.max_attempts' => 10,
        'rate_limits.global.email.daily.decay_seconds' => 86400,
    ]);
});

afterEach(function () {
    RateLimiter::clear(EmailRateLimiter::KEY);
    RateLimiter::clear(EmailRateLimiter::DAILY_KEY);
});

test('a successful smtp send records the mailer and accepted timestamp', function () {
    app(EmailSender::class)->send(
        'user@example.test',
        new LoginOtpMail('123456'),
    );

    $state = SmtpTransportState::query()->sole();

    expect($state->mailer)->toBe('smtp')
        ->and($state->last_accepted_at)->not->toBeNull()
        ->and(app(SmtpTransportStateStore::class)->lastAcceptedAt())
        ->not->toBeNull();
});

test('log sends do not create smtp transport state', function () {
    config(['mail.default' => 'log']);

    app(SmtpTransportStateStore::class)->recordAccepted();

    expect(SmtpTransportState::query()->count())->toBe(0);
});

test('daily email limit blocks after hourly capacity remains available', function () {
    config([
        'rate_limits.global.email.max_attempts' => 10,
        'rate_limits.global.email.daily.max_attempts' => 1,
    ]);

    app(EmailSender::class)->send(
        'first@example.test',
        new LoginOtpMail('123456'),
    );

    expect(fn () => app(EmailSender::class)->send(
        'second@example.test',
        new LoginOtpMail('654321'),
    ))->toThrow(EmailRateLimitExceededException::class);

    Mail::assertSent(LoginOtpMail::class, 1);
    expect(RateLimiter::attempts(EmailRateLimiter::KEY))->toBe(1)
        ->and(RateLimiter::attempts(EmailRateLimiter::DAILY_KEY))->toBe(1);
});
