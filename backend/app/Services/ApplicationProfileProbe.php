<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use Throwable;

class ApplicationProfileProbe
{
    // Only the canonical host is resolved; the transport is pinned to a vetted IP.
    public function resolve(string $host): array
    {
        if (! in_array($host, ['linkedin.com', 'github.com', 'instagram.com'], true) || ! function_exists('proc_open')) {
            return [];
        }

        // An isolated CLI resolver is bounded independently from libc DNS retries.
        $binary = PHP_SAPI === 'cli' ? PHP_BINARY : PHP_BINDIR.'/php';
        try {
            $process = new Process([$binary, '-r', 'echo json_encode(gethostbynamel($argv[1]) ?: []);', $host], timeout: 2);
            $process->run();
            $ips = $process->isSuccessful() ? json_decode($process->getOutput(), true) : null;

            return is_array($ips) ? array_values(array_filter($ips, 'is_string')) : [];
        } catch (Throwable) {
            return [];
        }
    }

    public function head(string $url, string $host, string $ip, int $timeoutMs): ?int
    {
        if (! function_exists('curl_init')) {
            return null;
        }
        $curl = curl_init($url);
        if ($curl === false) {
            return null;
        }
        try {
            if (! curl_setopt_array($curl, [
                CURLOPT_NOBODY => true,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_HEADER => false,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_RESOLVE => [$host.':443:'.$ip],
                CURLOPT_PROXY => '',
                CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_CONNECTTIMEOUT_MS => min(1500, $timeoutMs),
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_USERAGENT => 'GayDevs profile link validator',
                CURLOPT_WRITEFUNCTION => static fn ($handle, $data): int => 0,
            ])) {
                return null;
            }
            $headerBytes = 0;
            if (! curl_setopt($curl, CURLOPT_HEADERFUNCTION, static function ($handle, string $data) use (&$headerBytes): int {
                $headerBytes += strlen($data);

                return $headerBytes > 32768 ? 0 : strlen($data);
            })) {
                return null;
            }
            if (curl_exec($curl) === false || curl_getinfo($curl, CURLINFO_PRIMARY_IP) !== $ip) {
                return null;
            }

            return (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        } finally {
            curl_close($curl);
        }
    }
}
