<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Throwable;

class ApplicationProfileVerifier
{
    public function __construct(private ApplicationProfileUrl $urls, private ApplicationProfileProbe $probe) {}

    public function check(string $network, string $value): string
    {
        $url = $this->urls->normalize($network, $value);

        // No automated access to LinkedIn or Instagram without an authorized API
        // or permission from the provider. Syntax is still validated above.
        if ($network !== 'github') {
            return 'inconclusive';
        }

        return Cache::remember('application:profile:v2:'.hash_hmac('sha256', $url, (string) config('app.key')), 300, function () use ($url): string {
            try {
                $start = hrtime(true);
                $ips = $this->probe->resolve(ApplicationProfileProbe::HOST);
                if ($ips === []) {
                    return 'inconclusive';
                }
                foreach ($ips as $ip) {
                    if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_GLOBAL_RANGE)) {
                        return 'inconclusive';
                    }
                }
                $remaining = 3000 - (int) ((hrtime(true) - $start) / 1000000);
                if ($remaining <= 0) {
                    return 'inconclusive';
                }
                $handle = ltrim(parse_url($url, PHP_URL_PATH), '/');
                $result = $this->probe->lookup($handle, $ips[0], $remaining);
                if (($result['status'] ?? null) === 410) {
                    return 'invalid';
                }
                if (($result['status'] ?? null) === 200 && is_string($result['login'] ?? null)
                    && strcasecmp($result['login'], $handle) === 0) {
                    return 'valid';
                }
                // GitHub documents 404 for accounts hidden from the caller.
                // A public lookup cannot prove that such a profile is absent.
            } catch (Throwable) {
                // Never log the profile, handle or provider response.
            }

            return 'inconclusive';
        });
    }
}
