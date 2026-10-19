<?php

use App\Services\EmailMasker;

test('masks an email without exposing its complete parts', function () {
    $masked = app(EmailMasker::class)->mask('luciano@example.com');

    expect($masked)
        ->toBe('l******@e******.com')
        ->not->toContain('luciano')
        ->not->toContain('example');
});
