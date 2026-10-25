<?php

use App\Models\IpAddress;
use App\Models\IpGeolocation;
use App\Services\GeoIp\GeoIpLookup;
use App\Services\GeoIp\IpGeolocationUpdater;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function resolvedGeo(string $city = 'São Paulo'): array
{
    return [
        'country' => 'BR',
        'city' => $city,
        'asn' => 'AS64500',
        'city_database_type' => 'GeoLite2-City',
        'city_database_built_at' => now()->subDay()->startOfSecond(),
        'asn_database_type' => 'GeoLite2-ASN',
        'asn_database_built_at' => now()->subHours(2)->startOfSecond(),
        'geo_status' => 'resolved',
    ];
}

test('stores geo values and independent database build dates in a snapshot', function () {
    $geo = resolvedGeo();
    $this->mock(GeoIpLookup::class)->shouldReceive('lookup')->once()->andReturn($geo);
    $address = IpAddress::factory()->create();

    $snapshot = app(IpGeolocationUpdater::class)->update($address);

    expect($snapshot->city)->toBe('São Paulo')
        ->and($snapshot->city_database_type)->toBe('GeoLite2-City')
        ->and($snapshot->city_database_built_at->timestamp)->toBe($geo['city_database_built_at']->timestamp)
        ->and($snapshot->asn_database_type)->toBe('GeoLite2-ASN')
        ->and($snapshot->asn_database_built_at->timestamp)->toBe($geo['asn_database_built_at']->timestamp)
        ->and($snapshot->geo_status)->toBe('resolved');
});

test('reuses a fresh snapshot without repeating the local lookup', function () {
    $this->mock(GeoIpLookup::class)->shouldReceive('lookup')->once()->andReturn(resolvedGeo());
    $address = IpAddress::factory()->create();
    $service = app(IpGeolocationUpdater::class);

    $first = $service->update($address);
    $second = $service->update($address);

    expect($second->is($first))->toBeTrue()
        ->and($address->geolocations()->count())->toBe(1);
});

test('records a new snapshot when the same ip resolves to another city', function () {
    $lookup = $this->mock(GeoIpLookup::class);
    $lookup->shouldReceive('lookup')
        ->once()
        ->andReturn(resolvedGeo('São Paulo'));
    $lookup->shouldReceive('lookup')
        ->once()
        ->andReturn(resolvedGeo('Campinas'));
    $address = IpAddress::factory()->create();
    $service = app(IpGeolocationUpdater::class);
    $first = $service->update($address);
    $second = $service->update($address, force: true);

    expect($first->refresh()->valid_until)->not->toBeNull()
        ->and($second->city)->toBe('Campinas')
        ->and($second->valid_until)->toBeNull()
        ->and($address->geolocations()->count())->toBe(2);
});

test('keeps the prior location as history when a stale database cannot resolve a new value', function () {
    $address = IpAddress::factory()->create();
    $previous = IpGeolocation::factory()->for($address)->create([
        'country' => 'BR',
        'city' => 'São Paulo',
        'geo_status' => 'resolved',
        'last_verified_at' => now()->subDays(2),
    ]);
    $this->mock(GeoIpLookup::class)->shouldReceive('lookup')->once()->andReturn([
        'country' => null,
        'city' => null,
        'asn' => null,
        'city_database_type' => 'GeoLite2-City',
        'city_database_built_at' => now()->subDays(31),
        'asn_database_type' => 'GeoLite2-ASN',
        'asn_database_built_at' => now()->subDays(31),
        'geo_status' => 'stale',
    ]);

    $current = app(IpGeolocationUpdater::class)->update($address, force: true);

    expect($previous->refresh()->valid_until)->not->toBeNull()
        ->and($previous->city)->toBe('São Paulo')
        ->and($current->geo_status)->toBe('stale')
        ->and($current->city)->toBeNull();
});
