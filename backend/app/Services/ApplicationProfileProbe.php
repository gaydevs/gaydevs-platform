<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use Throwable;

class ApplicationProfileProbe
{
    public const HOST = 'api.github.com';

    public function resolve(string $host): array
    {
        if ($host !== self::HOST || ! function_exists('proc_open')) {
            return [];
        }
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

    /** Return only the status and public login; never retain the response body. */
    public function lookup(string $handle, string $ip, int $timeoutMs): ?array
    {
        if (! function_exists('curl_init')
            || ! preg_match('/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/D', $handle)
            || ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_GLOBAL_RANGE)) {
            return null;
        }
        $curl = curl_init('https://'.self::HOST.'/users/'.rawurlencode($handle));
        if ($curl === false) {
            return null;
        }
        try {
            $body = '';
            $headerBytes = 0;
            if (! curl_setopt_array($curl, [
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_HEADER => false,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_RESOLVE => [self::HOST.':443:'.$ip],
                CURLOPT_PROXY => '',
                CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_CONNECTTIMEOUT_MS => min(1500, $timeoutMs),
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_USERAGENT => 'GayDevs profile link validator',
                CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2026-03-10'],
                CURLOPT_WRITEFUNCTION => static function ($handle, string $data) use (&$body): int {
                    if (strlen($body) + strlen($data) > 32768) {
                        return 0;
                    }
                    $body .= $data;

                    return strlen($data);
                },
                CURLOPT_HEADERFUNCTION => static function ($handle, string $data) use (&$headerBytes): int {
                    $headerBytes += strlen($data);

                    return $headerBytes > 32768 ? 0 : strlen($data);
                },
            ])) {
                return null;
            }
            if (curl_exec($curl) === false || curl_getinfo($curl, CURLINFO_PRIMARY_IP) !== $ip) {
                return null;
            }
            $data = json_decode($body, true);

            return [
                'status' => (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE),
                'login' => is_string($data['login'] ?? null) ? $data['login'] : null,
            ];
        } finally {
            curl_close($curl);
        }
    }
}
