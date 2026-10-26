<?php

namespace App\Console\Commands;

use App\Exceptions\GeoIpUpdateException;
use App\Models\IpAddress;
use App\Services\GeoIp\GeoIpDatabaseUpdater;
use App\Services\GeoIp\IpGeolocationUpdater;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class UpdateGeoIpDatabases extends Command
{
    private const BATCH_SIZE = 100;

    protected $signature = 'geoip:update';

    protected $description = 'Atualiza e valida as bases locais GeoIP configuradas';

    public function handle(IpGeolocationUpdater $geolocation, GeoIpDatabaseUpdater $updater): int
    {
        if (! (bool) config('geoip.update_enabled')) {
            $this->info('Atualização GeoIP desabilitada.');

            return self::SUCCESS;
        }

        try {
            $databases = $updater->update();
        } catch (GeoIpUpdateException $exception) {
            Log::channel('operational')->error('geoip.update_failed', [
                'error' => $exception->getMessage(),
            ]);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        foreach ($databases as $label => $database) {
            $age = $database['built_at']->diffInDays(now());
            if ($age > (int) config('geoip.warning_age_days')) {
                $this->warn("Base GeoIP {$label} está com {$age} dias.");
            }

            $this->info("Base GeoIP {$label}: {$database['type']}, construída em {$database['built_at']->toIso8601String()}.");
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
}
