<?php

namespace App\Services\GeoIp;

use App\Exceptions\GeoIpUpdateException;
use Carbon\CarbonImmutable;
use GeoIp2\Database\Reader;
use Throwable;

class MaxMindGeoIpDatabaseValidator implements GeoIpDatabaseValidator
{
    public function validate(string $path, string $expectedType): array
    {
        try {
            $reader = new Reader($path);
            $metadata = $reader->metadata();
            $reader->close();
            $type = (string) $metadata->databaseType;
            $builtAt = CarbonImmutable::createFromTimestampUTC($metadata->buildEpoch);
        } catch (Throwable $exception) {
            throw new GeoIpUpdateException(
                "A base GeoIP {$expectedType} é inválida.",
                previous: $exception,
            );
        }

        if (! str_contains(strtolower($type), strtolower($expectedType))) {
            throw new GeoIpUpdateException(
                "A base GeoIP {$expectedType} tem tipo incompatível.",
            );
        }

        return [
            'type' => $type,
            'built_at' => $builtAt,
        ];
    }
}
