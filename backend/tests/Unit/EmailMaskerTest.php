<?php

use App\Services\EmailMasker;

test('masks an email without exposing its complete parts', function () {
    $masked = app(EmailMasker::class)->mask('luciano@example.com');

    expect($masked)
        ->toBe('l******@e******.com')
        ->not->toContain('luciano')
        ->not->toContain('example')
        ->toEndWith('.com');
});

test('reveals only a searched prefix at the start of the email', function () {
    $masker = app(EmailMasker::class);

    expect($masker->mask('gdev.luciano@email.com', 'Lu'))
        ->toBe('g***.lu*****@e****.com')
        ->and($masker->mask('luciano.gdev@email.com', 'gd'))
        ->toBe('l******.gd**@e****.com')
        ->and($masker->mask('luciano.gdev@email.com', 'luciano.g'))
        ->toBe('luciano.g***@e****.com')
        ->and($masker->mask('gdev.luciano@email.com', 'gdev'))
        ->toBe('gdev.l******@e****.com')
        ->and($masker->mask('gdev.luciano@email.com', 'luciano'))
        ->toBe('g***.luciano@e****.com')
        ->and($masker->mask('gdev.luciano@email.com', 'luciano.gdev'))
        ->toBe('luciano.gdev@e****.com');
});
