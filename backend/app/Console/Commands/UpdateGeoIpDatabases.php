<?php

namespace App\Console\Commands;

use App\Models\IpAddress;
use App\Services\GeoIp\GeoIpPackageUpdater;
use App\Services\GeoIp\IpGeolocationUpdater;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
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

        $phase = 'initialization';
        $edition = null;

        try {
            // Resolving after the feature flag avoids demanding MaxMind credentials
            // when the command is disabled.
            $updater = app(GeoIpPackageUpdater::class);
            $phase = 'update';
            $results = $updater->update();

            if ($failure = $this->resultFailure($results)) {
                return $this->failSafely('update', $failure['category'], $failure['edition']);
            }

            // No IP is reprocessed unless both editions were updated or confirmed current.
            $phase = 'metadata';
            foreach ($results as $result) {
                $edition = $result->edition;
                $metadata = $updater->metadata($result);
                $builtAt = CarbonImmutable::instance($metadata['builtAt']);
                $age = $builtAt->diffInDays(now());

                if ($age > (int) config('geoip.warning_age_days')) {
                    $this->warn("Base GeoIP {$result->edition} está com {$age} dias.");
                }

                $this->info("Base GeoIP {$result->edition}: {$metadata['type']}, construída em {$builtAt->toIso8601String()} ({$result->status}).");
            }
        } catch (Throwable $exception) {
            // Only a recognized category and the exception class reach the logs.
            // Neither the exception message nor its previous exceptions are logged.
            $category = $exception instanceof InvalidArgumentException
                ? 'configuration'
                : $this->errorCategory($exception->getMessage());

            return $this->failSafely($phase, $category, $edition, $exception);
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

    /**
     * Detect incomplete, unexpected or failed package responses before reprocessing IPs.
     *
     * @param  list<UpdateResult>  $results
     * @return array{category: string, edition: string|null}|null
     */
    private function resultFailure(array $results): ?array
    {
        $seen = [];

        foreach ($results as $result) {
            if (! in_array($result->edition, ['City', 'ASN'], true) || isset($seen[$result->edition])) {
                return ['category' => 'unexpected_result', 'edition' => null];
            }

            $seen[$result->edition] = true;

            if (! in_array($result->status, ['updated', 'current'], true)) {
                return [
                    'category' => $result->status === 'failed'
                        ? $this->errorCategory($result->reason)
                        : 'unexpected_result',
                    'edition' => $result->edition,
                ];
            }
        }

        return count($seen) === 2
            ? null
            : ['category' => 'incomplete_result', 'edition' => null];
    }

    /**
     * Whitelist diagnostic categories; never persist arbitrary package error text.
     */
    private function errorCategory(?string $reason): string
    {
        if (preg_match('/^MaxMind rejected the request \(HTTP (401|403)\)\.$/', $reason ?? '') === 1) {
            return 'authentication';
        }

        return match ($reason) {
            'Configuração dos caminhos GeoIP incompleta.',
            'Database directory must be absolute.',
            'Database path is not a directory.',
            'Database targets must be direct children of the database directory.' => 'configuration',

            'Network request failed.',
            'Temporary database service failure.',
            'Database download was empty.' => 'network',

            'Database validation failed.',
            'Database edition is incompatible.',
            'Database exceeds maximum age.' => 'validation',

            'Archive extraction failed.',
            'Archive contains an unsafe entry.',
            'Archive does not contain the expected database.' => 'archive',

            'Another GeoIP update is in progress.' => 'concurrency',

            'Cannot create database directory.',
            'Database directory is not writable.',
            'Cannot open update lock.',
            'Cannot create staging directory.',
            'Cannot stage database.',
            'Cannot install database.',
            'Cannot preserve current database.',
            'Cannot preserve database metadata.',
            'Cannot replace database.',
            'Cannot save database metadata.',
            'Installation failed.' => 'filesystem',

            default => 'unknown',
        };
    }

    /** Log safe operational diagnostics without exposing credentials, paths or raw errors. */
    private function failSafely(
        string $phase,
        string $category,
        ?string $edition = null,
        ?Throwable $exception = null,
    ): int {
        Log::channel('operational')->error('geoip.update_failed', [
            'reason' => 'database_update_failed',
            'phase' => $phase,
            'category' => $category,
            'edition' => $edition,
            'exception_class' => $exception === null ? null : $exception::class,
        ]);

        $this->error('Falha ao atualizar ou validar as bases GeoIP.');

        return self::FAILURE;
    }
}
