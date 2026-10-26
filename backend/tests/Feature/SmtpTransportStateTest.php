<?php

use App\Exceptions\EmailRateLimitExceededException;
use App\Mail\LoginOtpMail;
use App\Models\SmtpTransportState;
use App\Services\EmailRateLimiter;
use App\Services\EmailSender;
use App\Services\SmtpTransportStateStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Mockery\MockInterface;

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

test('accepted smtp state keeps one row when recorded repeatedly', function () {
    $store = app(SmtpTransportStateStore::class);

    $store->recordAccepted();
    $store->recordAccepted();

    expect(SmtpTransportState::query()->count())->toBe(1)
        ->and(SmtpTransportState::query()->sole()->last_accepted_at)->not->toBeNull();
});

test('smtp delivery remains successful when state persistence fails', function () {
    $logPath = storage_path('logs/operational-smtp-state-'.Str::uuid().'.log');
    config([
        'logging.channels.operational' => [
            'driver' => 'single',
            'path' => $logPath,
            'level' => 'error',
            'replace_placeholders' => true,
        ],
    ]);
    Log::forgetChannel('operational');

    $this->mock(SmtpTransportStateStore::class, function (MockInterface $mock): void {
        $mock->shouldReceive('recordAccepted')
            ->once()
            ->andThrow(new RuntimeException('sensitive state detail'));
    });

    try {
        app(EmailSender::class)->send(
            'user@example.test',
            new LoginOtpMail('123456'),
        );

        Mail::assertSent(LoginOtpMail::class, 1);
        expect(file_get_contents($logPath))
            ->toContain('email.transport_state_failed')
            ->toContain(RuntimeException::class)
            ->not->toContain('sensitive state detail')
            ->not->toContain('user@example.test')
            ->not->toContain('123456');
    } finally {
        Log::forgetChannel('operational');
        if (is_file($logPath)) {
            unlink($logPath);
        }
    }
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
