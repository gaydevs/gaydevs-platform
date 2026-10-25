<?php

namespace App\Services\GeoIp;

use App\Exceptions\GeoIpUpdateException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Throwable;

class MaxMindGeoIpDatabaseDownloader implements GeoIpDatabaseDownloader
{
    public function download(string $edition, string $destination): void
    {
        $accountId = config('geoip.account_id');
        $licenseKey = config('geoip.license_key');

        if (! is_string($accountId) || trim($accountId) === ''
            || ! is_string($licenseKey) || trim($licenseKey) === '') {
            throw new GeoIpUpdateException('As credenciais do GeoIP não estão configuradas.');
        }

        $baseUrl = rtrim((string) config('geoip.download_base_url'), '/');
        $url = $baseUrl.'/'.rawurlencode($edition).'/download?suffix=tar.gz';

        $attempts = max(1, (int) config('geoip.download_retry_attempts'));
        $sleepMilliseconds = max(0, (int) config('geoip.download_retry_sleep_milliseconds'));
        $lastException = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            @unlink($destination);

            try {
                $response = Http::withBasicAuth($accountId, $licenseKey)
                    ->accept('*/*')
                    ->timeout((int) config('geoip.download_timeout_seconds'))
                    ->sink($destination)
                    ->get($url);
            } catch (Throwable $exception) {
                $lastException = $exception;

                if (! $this->shouldRetry($exception) || $attempt === $attempts) {
                    throw new GeoIpUpdateException(
                        "Não foi possível baixar a base GeoIP {$edition}.",
                        previous: $exception,
                    );
                }

                $this->sleepBeforeRetry($sleepMilliseconds);

                continue;
            }

            if ($response->successful() && is_file($destination) && (int) filesize($destination) > 0) {
                return;
            }

            if ($this->shouldRetryResponse($response->status()) && $attempt < $attempts) {
                $this->sleepBeforeRetry($sleepMilliseconds);

                continue;
            }

            if (! $response->successful()) {
                throw new GeoIpUpdateException(
                    "A MaxMind recusou o download da base GeoIP {$edition} (HTTP {$response->status()}).",
                );
            }

            throw new GeoIpUpdateException("O download da base GeoIP {$edition} ficou vazio.");
        }

        throw new GeoIpUpdateException(
            "Não foi possível baixar a base GeoIP {$edition}.",
            previous: $lastException,
        );
    }

    private function shouldRetry(Throwable $exception): bool
    {
        return $exception instanceof ConnectionException
            || ($exception instanceof RequestException && $exception->response?->serverError());
    }

    private function shouldRetryResponse(int $status): bool
    {
        return $status === 429 || $status >= 500;
    }

    private function sleepBeforeRetry(int $milliseconds): void
    {
        if ($milliseconds > 0) {
            usleep($milliseconds * 1000);
        }
    }
}
