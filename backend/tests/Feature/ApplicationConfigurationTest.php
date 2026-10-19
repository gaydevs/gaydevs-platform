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
