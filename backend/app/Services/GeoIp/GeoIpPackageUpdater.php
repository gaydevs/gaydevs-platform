<?php

namespace App\Services\GeoIp;

use Luvittor\GeoIpUpdater\Contract\DatabaseValidator;
use Luvittor\GeoIpUpdater\Edition;
use Luvittor\GeoIpUpdater\Exception\UpdateException;
use Luvittor\GeoIpUpdater\UpdateOptions;
use Luvittor\GeoIpUpdater\Updater;
use Luvittor\GeoIpUpdater\UpdateResult;

final class GeoIpPackageUpdater
{
    public function __construct(
        private readonly Updater $updater,
        private readonly DatabaseValidator $validator,
    ) {}

    /** @return list<UpdateResult> */
    public function update(): array
    {
        $directory = config('geoip.database_directory');
        $city = config('geoip.city_database');
        $asn = config('geoip.asn_database');

        if (! is_string($directory) || trim($directory) === ''
            || ! is_string($city) || trim($city) === ''
            || ! is_string($asn) || trim($asn) === '') {
            throw new UpdateException('Configuração dos caminhos GeoIP incompleta.');
        }

        return $this->updater->update(new UpdateOptions(
            directory: $directory,
            editions: [
                new Edition('City', 'City', $city),
                new Edition('ASN', 'ASN', $asn),
            ],
            maxAgeDays: (int) config('geoip.max_age_days'),
            // Preserve the old non-blocking behaviour on overlapping runs.
            lockTimeoutSeconds: 0,
        ));
    }

    /** @return array{type: string, builtAt: \DateTimeImmutable} */
    public function metadata(UpdateResult $result): array
    {
        return $this->validator->validate($result->path, $result->edition);
    }
}
