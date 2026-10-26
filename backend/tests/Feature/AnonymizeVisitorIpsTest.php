<?php

use App\Models\IpAddress;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('scheduled command only anonymizes ips not observed for at least 90 days', function () {
    $old = IpAddress::factory()->create([
        'ip' => '203.0.113.123',
        'last_observed_at' => now()->subDays(91),
    ]);
    $recent = IpAddress::factory()->create([
        'ip' => '203.0.113.124',
        'last_observed_at' => now()->subDays(89),
    ]);

    $this->artisan('visitors:anonymize-ips')->assertSuccessful();

    expect($old->refresh()->ip)->toBe('203.0.113.0')
        ->and($old->ip_anonymized_at)->not->toBeNull()
        ->and($recent->refresh()->ip)->toBe('203.0.113.124')
        ->and($recent->ip_anonymized_at)->toBeNull();
});

test('scheduled command anonymizes ipv6 to a slash 48 network', function () {
    $address = IpAddress::factory()->create([
        'ip' => '2001:db8:abcd:1234::42',
        'last_observed_at' => now()->subDays(91),
    ]);

    $this->artisan('visitors:anonymize-ips')->assertSuccessful();

    expect($address->refresh()->ip)->toBe('2001:db8:abcd::')
        ->and($address->ip_anonymized_at)->not->toBeNull();
});
