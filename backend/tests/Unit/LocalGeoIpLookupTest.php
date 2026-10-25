<?php

use App\Services\GeoIp\LocalGeoIpLookup;
use Tests\TestCase;

uses(TestCase::class);

test('geoip lookup stays local and tolerates absent databases', function () {
    config([
        'geoip.city_database' => __DIR__.'/missing-city.mmdb',
        'geoip.asn_database' => __DIR__.'/missing-asn.mmdb',
    ]);

    expect(app(LocalGeoIpLookup::class)->lookup('203.0.113.10'))->toBe([
        'country' => null,
        'city' => null,
        'asn' => null,
        'city_database_type' => null,
        'city_database_built_at' => null,
        'asn_database_type' => null,
        'asn_database_built_at' => null,
        'geo_status' => 'unavailable',
    ]);
});

test('functional geoip lookup reads the locally installed MaxMind databases', function () {
    $cityDatabase = config('geoip.city_database');
    $asnDatabase = config('geoip.asn_database');

    if (! is_string($cityDatabase) || ! is_file($cityDatabase)
        || ! is_string($asnDatabase) || ! is_file($asnDatabase)) {
        $this->markTestSkipped('Bases GeoIP locais não estão instaladas.');
    }

    $result = app(LocalGeoIpLookup::class)->lookup('8.8.8.8');

    expect($result['geo_status'])->toBeIn(['resolved', 'partial'])
        ->and($result['city_database_type'])->toContain('City')
        ->and($result['asn_database_type'])->toContain('ASN')
        ->and($result['city_database_built_at'])->not->toBeNull()
        ->and($result['asn_database_built_at'])->not->toBeNull();
});
