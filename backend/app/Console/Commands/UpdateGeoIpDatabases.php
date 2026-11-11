<?php

namespace App\Console\Commands;

use App\Models\IpAddress;
use App\Services\GeoIp\GeoIpPackageUpdater;
use App\Services\GeoIp\IpGeolocationUpdater;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Luvittor\GeoIpUpdater\Exception\UpdateException;
use Luvittor\GeoIpUpdater\UpdateResult;
use Throwable;

class UpdateGeoIpDatabases extends Command
{
    private const BATCH_SIZE = 100;

    private const SAFE_ERROR_CODES = [
        'authentication_failed', 'authorization_failed', 'request_rejected',
        'network_failure', 'temporary_http_failure', 'empty_download',
        'redirect_limit_exceeded', 'unsafe_redirect', 'insecure_redirect_downgrade',
        'update_failed',
    ];

    private const SAFE_PACKAGE_PHASES = ['http', 'metadata', 'download', 'update'];

    protected $signature = 'geoip:update {--force-reprocess : Reprocessa IPs mesmo com as bases atuais}';

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
            // Resolving after the feature flag avoids demanding credentials when disabled.
            $updater = app(GeoIpPackageUpdater::class);
            $phase = 'update';
            $results = $updater->update();

            if ($failure = $this->resultFailure($results)) {
                return $this->failSafely('update', $failure['category'], $failure['edition'], null, $failure['diagnostics']);
            }

            // Both editions must be present and valid, regardless of reprocessing.
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
            $diagnostics = $exception instanceof UpdateException
                ? $this->safeDiagnostics($exception->errorCode, $exception->phase, $exception->httpStatus, $exception->attempts)
                : $this->safeDiagnostics();
            $category = $exception instanceof InvalidArgumentException
                ? 'configuration'
                : $this->categoryForErrorCode($diagnostics['error_code']);

            return $this->failSafely($phase, $category, $edition, $exception, $diagnostics);
        }

        $hasNewDatabase = collect($results)->contains(static fn (UpdateResult $result): bool => $result->status === 'updated');
        if (! $hasNewDatabase && ! $this->option('force-reprocess')) {
            $this->info('Bases GeoIP atuais; reprocessamento de IPs dispensado.');

            return self::SUCCESS;
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
     * No failed, duplicate or missing edition may trigger reprocessing, even if forced.
     *
     * @param  list<UpdateResult>  $results
     * @return array{category:string,edition:?string,diagnostics:array}|null
     */
    private function resultFailure(array $results): ?array
    {
        $seen = [];

        foreach ($results as $result) {
            if (! in_array($result->edition, ['City', 'ASN'], true) || isset($seen[$result->edition])) {
                return ['category' => 'unexpected_result', 'edition' => null, 'diagnostics' => $this->safeDiagnostics()];
            }

            $seen[$result->edition] = true;

            if (! in_array($result->status, ['updated', 'current'], true)) {
                $diagnostics = $result->status === 'failed'
                    ? $this->safeDiagnostics($result->errorCode, $result->phase, $result->httpStatus, $result->attempts)
                    : $this->safeDiagnostics();

                return [
                    'category' => $result->status === 'failed'
                        ? $this->categoryForErrorCode($diagnostics['error_code'])
                        : 'unexpected_result',
                    'edition' => $result->edition,
                    'diagnostics' => $diagnostics,
                ];
            }
        }

        return count($seen) === 2
            ? null
            : ['category' => 'incomplete_result', 'edition' => null, 'diagnostics' => $this->safeDiagnostics()];
    }

    /** Never copy arbitrary package strings into operational logs. */
    private function safeDiagnostics(
        ?string $code = null,
        ?string $phase = null,
        ?int $httpStatus = null,
        ?int $attempts = null,
    ): array {
        return [
            'error_code' => in_array($code, self::SAFE_ERROR_CODES, true) ? $code : 'unknown',
            'package_phase' => in_array($phase, self::SAFE_PACKAGE_PHASES, true) ? $phase : null,
            'http_status' => $httpStatus >= 100 && $httpStatus <= 599 ? $httpStatus : null,
            'attempts' => $attempts >= 1 && $attempts <= 20 ? $attempts : null,
        ];
    }

    private function categoryForErrorCode(?string $code): string
    {
        return match ($code) {
            'authentication_failed', 'authorization_failed' => 'authentication',
            'network_failure', 'temporary_http_failure', 'empty_download',
            'redirect_limit_exceeded', 'unsafe_redirect', 'request_rejected' => 'network',
            'insecure_redirect_downgrade' => 'security',
            default => 'unknown',
        };
    }

    /** Log only whitelisted diagnostics, never URLs, credentials or raw exception messages. */
    private function failSafely(
        string $phase,
        string $category,
        ?string $edition = null,
        ?Throwable $exception = null,
        array $diagnostics = [],
    ): int {
        Log::channel('operational')->error('geoip.update_failed', [
            'reason' => 'database_update_failed',
            'phase' => $phase,
            'category' => $category,
            'edition' => $edition,
            ...($diagnostics ?: $this->safeDiagnostics()),
            'exception_class' => $exception === null ? null : $exception::class,
        ]);

        $this->error('Falha ao atualizar ou validar as bases GeoIP.');

        return self::FAILURE;
    }
}
