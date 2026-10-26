<?php

namespace App\Services\GeoIp;

use App\Models\IpAddress;
use App\Models\IpGeolocation;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

class IpGeolocationUpdater
{
    public function __construct(private readonly GeoIpLookup $geoIp) {}

    public function update(IpAddress $address, bool $force = false): IpGeolocation
    {
        $current = $address->geolocations()
            ->whereNull('valid_until')
            ->latest('valid_from')
            ->first();

        if (! $force && $current !== null && $this->cacheIsFresh($current)) {
            return $current;
        }

        $geo = $this->geoIp->lookup($address->ip);
        $now = now();

        return DB::transaction(function () use ($address, $geo, $now): IpGeolocation {
            $lockedAddress = IpAddress::query()->lockForUpdate()->findOrFail($address->id);
            $current = $lockedAddress->geolocations()
                ->whereNull('valid_until')
                ->latest('valid_from')
                ->first();

            if ($current !== null && $this->sameSnapshot($current, $geo)) {
                $current->update(['last_verified_at' => $now]);

                return $current;
            }

            $current?->update(['valid_until' => $now]);

            return $lockedAddress->geolocations()->create([
                'country' => $geo['country'],
                'city' => $geo['city'],
                'asn' => $geo['asn'],
                'city_database_type' => $geo['city_database_type'],
                'city_database_built_at' => $geo['city_database_built_at'],
                'asn_database_type' => $geo['asn_database_type'],
                'asn_database_built_at' => $geo['asn_database_built_at'],
                'geo_status' => $geo['geo_status'],
                'resolved_at' => $now,
                'last_verified_at' => $now,
                'valid_from' => $now,
            ]);
        });
    }

    private function cacheIsFresh(IpGeolocation $geolocation): bool
    {
        if (in_array($geolocation->geo_status, ['unavailable', 'error', 'stale'], true)) {
            return $geolocation->last_verified_at->gte(
                now()->subMinutes((int) config('geoip.retry_minutes')),
            );
        }

        return $geolocation->last_verified_at->gte(
            now()->subHours((int) config('geoip.lookup_ttl_hours')),
        );
    }

    /** @param array<string, mixed> $geo */
    private function sameSnapshot(IpGeolocation $current, array $geo): bool
    {
        return $current->country === $geo['country']
            && $current->city === $geo['city']
            && $current->asn === $geo['asn']
            && $current->city_database_type === $geo['city_database_type']
            && $this->timestamp($current->city_database_built_at) === $this->timestamp($geo['city_database_built_at'])
            && $current->asn_database_type === $geo['asn_database_type']
            && $this->timestamp($current->asn_database_built_at) === $this->timestamp($geo['asn_database_built_at'])
            && $current->geo_status === $geo['geo_status'];
    }

    private function timestamp(mixed $value): ?int
    {
        return $value instanceof DateTimeInterface ? $value->getTimestamp() : null;
    }
}
