<?php

namespace App\Services\GeoIp;

use Carbon\CarbonImmutable;

interface GeoIpDatabaseValidator
{
    /** @return array{type: string, built_at: CarbonImmutable} */
    public function validate(string $path, string $expectedType): array;
}
