<?php

namespace App\Services\GeoIp;

use Carbon\CarbonImmutable;
use GeoIp2\Database\Reader;
use GeoIp2\Exception\AddressNotFoundException;
use Throwable;

class LocalGeoIpLookup implements GeoIpLookup
{
    public function lookup(?string $ip): array
    {
        $result = [
            'country' => null,
            'city' => null,
            'asn' => null,
            'city_database_type' => null,
            'city_database_built_at' => null,
            'asn_database_type' => null,
            'asn_database_built_at' => null,
            'geo_status' => 'unavailable',
        ];

        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return $result;
        }

        $statuses = [];
        $this->readCity($ip, $result, $statuses);
        $this->readAsn($ip, $result, $statuses);
        $result['geo_status'] = $this->combineStatuses($statuses);

        return $result;
    }

    /** @param array<string, mixed> $result @param list<string> $statuses */
    private function readCity(string $ip, array &$result, array &$statuses): void
    {
        $path = config('geoip.city_database');
        if (! is_string($path) || ! is_file($path)) {
            $statuses[] = 'unavailable';

            return;
        }

        try {
            $reader = new Reader($path);
            $metadata = $reader->metadata();
            $builtAt = CarbonImmutable::createFromTimestampUTC($metadata->buildEpoch);
            $result['city_database_type'] = $metadata->databaseType;
            $result['city_database_built_at'] = $builtAt;

            if ($this->isTooOld($builtAt)) {
                $statuses[] = 'stale';
                $reader->close();

                return;
            }

            $record = $reader->city($ip);
            $result['country'] = $record->country->isoCode;
            $result['city'] = $record->city->name;
            $statuses[] = 'resolved';
            $reader->close();
        } catch (Throwable $exception) {
            $statuses[] = $exception instanceof AddressNotFoundException ? 'not_found' : 'error';
        }
    }

    /** @param array<string, mixed> $result @param list<string> $statuses */
    private function readAsn(string $ip, array &$result, array &$statuses): void
    {
        $path = config('geoip.asn_database');
        if (! is_string($path) || ! is_file($path)) {
            $statuses[] = 'unavailable';

            return;
        }

        try {
            $reader = new Reader($path);
            $metadata = $reader->metadata();
            $builtAt = CarbonImmutable::createFromTimestampUTC($metadata->buildEpoch);
            $result['asn_database_type'] = $metadata->databaseType;
            $result['asn_database_built_at'] = $builtAt;

            if ($this->isTooOld($builtAt)) {
                $statuses[] = 'stale';
                $reader->close();

                return;
            }

            $record = $reader->asn($ip);
            $result['asn'] = $record->autonomousSystemNumber === null
                ? null
                : 'AS'.$record->autonomousSystemNumber;
            $statuses[] = 'resolved';
            $reader->close();
        } catch (Throwable $exception) {
            $statuses[] = $exception instanceof AddressNotFoundException ? 'not_found' : 'error';
        }
    }

    private function isTooOld(CarbonImmutable $builtAt): bool
    {
        return $builtAt->lt(now()->subDays((int) config('geoip.max_age_days')));
    }

    /** @param list<string> $statuses */
    private function combineStatuses(array $statuses): string
    {
        foreach (['stale', 'error'] as $priority) {
            if (in_array($priority, $statuses, true)) {
                return $priority;
            }
        }

        if (in_array('resolved', $statuses, true)) {
            return count(array_unique($statuses)) === 1 ? 'resolved' : 'partial';
        }

        return in_array('not_found', $statuses, true) ? 'not_found' : 'unavailable';
    }
}
