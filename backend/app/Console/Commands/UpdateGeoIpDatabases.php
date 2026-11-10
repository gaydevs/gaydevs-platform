<?php

namespace App\Console\Commands;

use App\Models\IpAddress;
use App\Services\GeoIp\GeoIpPackageUpdater;
use App\Services\GeoIp\IpGeolocationUpdater;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Luvittor\GeoIpUpdater\UpdateResult;
use Throwable;

class UpdateGeoIpDatabases extends Command
{
    private const BATCH_SIZE = 100;

    protected $signature = 'geoip:update';

    protected $description = 'Atualiza e valida as bases locais GeoIP configuradas';

    public function handle(IpGeolocationUpdater $geolocation): int
    {
        if (! (bool) config('geoip.update_enabled')) {
            $this->info('Atualização GeoIP desabilitada.');

            return self::SUCCESS;
        }

        try {
            // Resolving after the feature flag avoids demanding MaxMind credentials
            // when the command is disabled.
            $updater = app(GeoIpPackageUpdater::class);
            $results = $updater->update();

            if ($this->hasFailures($results)) {
                return $this->failSafely();
            }

            // No IP is reprocessed unless both editions were updated or confirmed current.
            foreach ($results as $result) {
                $metadata = $updater->metadata($result);
                $builtAt = CarbonImmutable::instance($metadata['builtAt']);
                $age = $builtAt->diffInDays(now());

                if ($age > (int) config('geoip.warning_age_days')) {
                    $this->warn("Base GeoIP {$result->edition} está com {$age} dias.");
                }

                $this->info("Base GeoIP {$result->edition}: {$metadata['type']}, construída em {$builtAt->toIso8601String()} ({$result->status}).");
            }
        } catch (Throwable) {
            // Never record raw exception messages: third-party transports can
            // include Authorization headers or license keys in previous exceptions.
            return $this->failSafely();
        }

        $updated = 0;
        IpAddress::query()
            ->whereNull('ip_anonymized_at')
            ->chunkById(self::BATCH_SIZE, function ($addresses) use ($geolocation, &$updated): void {
                foreach ($addresses as $address) {
                    /** @var IpAddress $address */
                    $geolocation->update($address, force: true);
                    $updated++;
                }
            });
        $this->info("{$updated} IP(s) reprocessado(s) com as bases atuais.");

        return self::SUCCESS;
    }

    /** @param list<UpdateResult> $results */
    private function hasFailures(array $results): bool
    {
        if (count($results) !== 2) {
            return true;
        }

        $expected = ['ASN', 'City'];
        $actual = [];

        foreach ($results as $result) {
            if (! in_array($result->status, ['updated', 'current'], true)) {
                return true;
            }

            $actual[] = $result->edition;
        }

        sort($actual);

        return $actual !== $expected;
    }

    private function failSafely(): int
    {
        Log::channel('operational')->error('geoip.update_failed', [
            'reason' => 'database_update_failed',
        ]);
        $this->error('Falha ao atualizar ou validar as bases GeoIP.');

        return self::FAILURE;
    }
}
