<?php

namespace App\Console\Commands;

use App\Models\IpAddress;
use App\Services\IpGeolocationUpdater;
use Carbon\CarbonImmutable;
use GeoIp2\Database\Reader;
use Illuminate\Console\Command;
use Symfony\Component\Process\Process;
use Throwable;

class UpdateGeoIpDatabases extends Command
{
    protected $signature = 'geoip:update';

    protected $description = 'Atualiza e valida as bases locais GeoIP configuradas';

    public function handle(IpGeolocationUpdater $geolocation): int
    {
        $binary = config('geoip.update_binary');
        $configuration = config('geoip.update_config');
        $directory = config('geoip.database_directory');

        if (! is_string($binary) || ! is_file($binary)
            || ! is_string($configuration) || ! is_file($configuration)
            || ! is_string($directory) || ! is_dir($directory)) {
            $this->error('GeoIP updater não está completamente provisionado.');

            return self::FAILURE;
        }

        $process = new Process([$binary, '-f', $configuration, '-d', $directory]);
        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->error(trim($process->getErrorOutput()) ?: 'geoipupdate falhou.');

            return self::FAILURE;
        }

        foreach ([
            'City' => config('geoip.city_database'),
            'ASN' => config('geoip.asn_database'),
        ] as $label => $path) {
            if (! is_string($path) || ! is_file($path)) {
                $this->error("Base GeoIP {$label} ausente depois da atualização.");

                return self::FAILURE;
            }

            try {
                $reader = new Reader($path);
                $metadata = $reader->metadata();
                $builtAt = CarbonImmutable::createFromTimestampUTC($metadata->buildEpoch);
                $reader->close();
            } catch (Throwable $exception) {
                $this->error("Base GeoIP {$label} inválida: {$exception->getMessage()}");

                return self::FAILURE;
            }

            $age = $builtAt->diffInDays(now());
            if ($age > (int) config('geoip.max_age_days', 30)) {
                $this->error("Base GeoIP {$label} excede a idade máxima ({$age} dias).");

                return self::FAILURE;
            }

            if ($age > (int) config('geoip.warning_age_days', 7)) {
                $this->warn("Base GeoIP {$label} está com {$age} dias.");
            }

            $this->info("Base GeoIP {$label}: {$metadata->databaseType}, construída em {$builtAt->toIso8601String()}.");
        }

        $updated = 0;
        IpAddress::query()
            ->whereNull('ip_anonymized_at')
            ->chunkById(100, function ($addresses) use ($geolocation, &$updated): void {
                foreach ($addresses as $address) {
                    /** @var IpAddress $address */
                    $geolocation->update($address, force: true);
                    $updated++;
                }
            });
        $this->info("{$updated} IP(s) reprocessado(s) com as bases atuais.");

        return self::SUCCESS;
    }
}
