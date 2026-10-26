<?php

use App\Mail\SmtpKeepaliveMail;
use App\Models\OtpRequest;
use App\Models\SmtpTransportState;
use App\Services\EmailRateLimiter;
use App\Services\EmailSender;
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
        'mail.from.address' => 'verified@example.test',
        'mail.from.name' => 'gdevs',
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

test('keepalive is inactive when no accepted smtp send is recorded', function () {
    $this->artisan('smtp:keepalive')->assertSuccessful();

    Mail::assertNothingSent();
    expect(SmtpTransportState::query()->count())->toBe(0)
        ->and(OtpRequest::query()->count())->toBe(0);
});

test('keepalive is inactive while the last smtp send is recent', function () {
    $lastAcceptedAt = now()->subDays(79)->startOfSecond();
    SmtpTransportState::query()->create([
        'mailer' => 'smtp',
        'last_accepted_at' => $lastAcceptedAt,
    ]);

    $this->artisan('smtp:keepalive')->assertSuccessful();

    Mail::assertNothingSent();
    expect(SmtpTransportState::query()->sole()->last_accepted_at)
        ->toEqual($lastAcceptedAt);
});

test('keepalive sends to the configured from address after 80 days and refreshes state', function () {
    $this->freezeTime();
    SmtpTransportState::query()->create([
        'mailer' => 'smtp',
        'last_accepted_at' => now()->subDays(80)->startOfSecond(),
    ]);

    $this->artisan('smtp:keepalive')->assertSuccessful();

    Mail::assertSent(SmtpKeepaliveMail::class, function (SmtpKeepaliveMail $mail): bool {
        return data_get($mail->to, '0.address') === 'verified@example.test';
    });

    $this->artisan('smtp:keepalive')->assertSuccessful();

    expect(SmtpTransportState::query()->sole()->last_accepted_at->toDateTimeString())
        ->toBe(now()->startOfSecond()->toDateTimeString())
        ->and(OtpRequest::query()->count())->toBe(0);
    Mail::assertSent(SmtpKeepaliveMail::class, 1);
});

test('keepalive does not send while the effective mailer is log', function () {
    config(['mail.default' => 'log']);
    $lastAcceptedAt = now()->subDays(81)->startOfSecond();
    SmtpTransportState::query()->create([
        'mailer' => 'smtp',
        'last_accepted_at' => $lastAcceptedAt,
    ]);

    $this->artisan('smtp:keepalive')->assertSuccessful();

    Mail::assertNothingSent();
    expect(SmtpTransportState::query()->sole()->last_accepted_at)
        ->toEqual($lastAcceptedAt);
});

test('keepalive reports a sanitized failure and preserves the previous state', function () {
    $logPath = storage_path('logs/smtp-keepalive-test-'.Str::uuid().'.log');
    config([
        'logging.channels.operational' => [
            'driver' => 'single',
            'path' => $logPath,
            'level' => 'error',
            'replace_placeholders' => true,
        ],
    ]);
    Log::forgetChannel('operational');

    $lastAcceptedAt = now()->subDays(81)->startOfSecond();
    SmtpTransportState::query()->create([
        'mailer' => 'smtp',
        'last_accepted_at' => $lastAcceptedAt,
    ]);

    $this->mock(EmailSender::class, function (MockInterface $mock): void {
        $mock->shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('sensitive transport detail'));
    });

    try {
        $this->artisan('smtp:keepalive')->assertFailed();

        $log = file_get_contents($logPath);

        expect($log)
            ->toContain('smtp.keepalive_failed')
            ->toContain(RuntimeException::class)
            ->not->toContain('sensitive transport detail')
            ->and(SmtpTransportState::query()->sole()->last_accepted_at)
            ->toEqual($lastAcceptedAt);
        Mail::assertNothingSent();
    } finally {
        Log::forgetChannel('operational');
        if (is_file($logPath)) {
            unlink($logPath);
        }
    }
});

test('keepalive message is technical and contains no otp data', function () {
    $message = new SmtpKeepaliveMail;

    expect($message->envelope()->subject)
        ->toBe('Manutenção do transporte de e-mail gdevs')
        ->and($message->render())
        ->toContain('manutenção do transporte SMTP')
        ->not->toContain('OTP');
});
