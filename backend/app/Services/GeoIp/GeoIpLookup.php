<?php

namespace App\Services\GeoIp;

interface GeoIpLookup
{
    /**
     * @return array{
     *   country: ?string, city: ?string, asn: ?string,
     *   city_database_type: ?string, city_database_built_at: mixed,
     *   asn_database_type: ?string, asn_database_built_at: mixed,
     *   geo_status: string
     * }
     */
    public function lookup(?string $ip): array;
}
