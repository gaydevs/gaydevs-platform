<?php

test('application and scheduler use Sao Paulo time', function () {
    expect(config('app.timezone'))->toBe('America/Sao_Paulo')
        ->and(date_default_timezone_get())->toBe('America/Sao_Paulo');

    $this->artisan('schedule:list')
        ->expectsOutputToContain('visitors:anonymize-ips')
        ->assertSuccessful();
});

test('web session lifetime has one sliding expiration setting', function () {
    expect(config('session.lifetime'))->toBe(129600)
        ->and(config('session.expire_on_close'))->toBeFalse();
});

test('passwordless policy centralizes the approved otp and rate limits', function () {
    expect(config('passwordless.otp'))->toBe([
        'digits' => 6,
        'expires_in_minutes' => 10,
        'max_verification_attempts' => 5,
        'max_generation_attempts' => 100,
    ])->and(config('passwordless.search'))->toBe([
        'query_max_characters' => 100,
        'max_results' => 5,
    ])->and(config('passwordless.rate_limits'))->toBe([
        'request_per_user' => ['max_attempts' => 5, 'decay_seconds' => 3600],
        'request_per_ip' => ['max_attempts' => 20, 'decay_seconds' => 3600],
        'search_per_ip' => ['max_attempts' => 60, 'decay_seconds' => 60],
    ]);
});

test('visitor policy centralizes identity observation and retention limits', function () {
    expect(config('visitors'))->toBe([
        'cookie_lifetime_years' => 5,
        'visit_window_minutes' => 30,
        'ip_retention_days' => 90,
        'observation' => [
            'language_max_characters' => 64,
            'path_max_characters' => 512,
        ],
    ]);
});

test('operational failures use a dedicated retained daily log', function () {
    expect(config('logging.channels.operational.driver'))->toBe('daily')
        ->and(config('logging.channels.operational.path'))->toBe(storage_path('logs/operational.log'))
        ->and(config('logging.channels.operational.level'))->toBe('error')
        ->and(config('logging.channels.operational.days'))->toBe(30);
});
