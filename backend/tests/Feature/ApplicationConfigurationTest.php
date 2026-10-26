<?php

test('application and scheduler use Sao Paulo time', function () {
    expect(config('app.timezone'))->toBe('America/Sao_Paulo')
        ->and(date_default_timezone_get())->toBe('America/Sao_Paulo');

    $this->artisan('schedule:list')
        ->expectsOutputToContain('visitors:anonymize-ips')
        ->expectsOutputToContain('smtp:keepalive')
        ->assertSuccessful();
});

test('smtp mailer reads the approved environment-driven transport settings', function () {
    config([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.transport' => 'smtp',
        'mail.mailers.smtp.scheme' => 'tls',
        'mail.mailers.smtp.host' => 'smtp-relay.brevo.com',
        'mail.mailers.smtp.port' => 587,
        'mail.mailers.smtp.username' => 'smtp-login@example.test',
        'mail.mailers.smtp.password' => 'test-only-secret',
        'mail.from.address' => 'verified@example.test',
        'mail.from.name' => 'gdevs',
    ]);

    expect(config('mail.default'))->toBe('smtp')
        ->and(config('mail.mailers.smtp'))->toMatchArray([
            'transport' => 'smtp',
            'scheme' => 'tls',
            'host' => 'smtp-relay.brevo.com',
            'port' => 587,
            'username' => 'smtp-login@example.test',
            'password' => 'test-only-secret',
        ])
        ->and(config('mail.from'))->toBe([
            'address' => 'verified@example.test',
            'name' => 'gdevs',
        ]);
});

test('web session lifetime has a valid sliding configuration', function () {
    expect(config('session.lifetime'))->toBeInt()->toBeGreaterThan(0)
        ->and(config('session.expire_on_close'))->toBeFalse();
});

test('passwordless and global rate-limit policies centralize approved settings', function () {
    expect(config('passwordless.otp'))->toBe([
        'digits' => 6,
        'expires_in_minutes' => 10,
        'max_verification_attempts' => 5,
        'max_generation_attempts' => 100,
        'superseded_code_lookup_limit' => 5,
    ])->and(config('passwordless.search'))->toBe([
        'query_max_characters' => 100,
        'max_results' => 5,
    ]);

    $limits = config('passwordless.rate_limits');
    expect($limits)->toHaveKeys([
        'request_per_user',
        'request_per_ip',
        'search_per_ip',
        'verify_per_ip',
    ]);

    foreach ($limits as $limit) {
        expect($limit)->toHaveKeys(['max_attempts', 'decay_seconds'])
            ->and($limit['max_attempts'])->toBeInt()->toBeGreaterThan(0)
            ->and($limit['decay_seconds'])->toBeInt()->toBeGreaterThan(0);
    }

    $globalLimits = config('rate_limits.global');
    expect($globalLimits)->toHaveKeys(['otp', 'email']);

    expect($globalLimits['email']['daily'])->toBe([
        'max_attempts' => 250,
        'decay_seconds' => 86400,
    ]);

    expect($globalLimits['email']['max_attempts'])->toBe(150)
        ->and($globalLimits['email']['decay_seconds'])->toBe(3600);

    foreach ($globalLimits as $limit) {
        expect($limit)->toHaveKeys(['max_attempts', 'decay_seconds'])
            ->and($limit['max_attempts'])->toBeInt()->toBeGreaterThan(0)
            ->and($limit['decay_seconds'])->toBeInt()->toBeGreaterThan(0);
    }
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
