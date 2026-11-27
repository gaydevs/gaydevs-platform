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

        return Cache::remember('application:profile:'.hash_hmac('sha256', $url, (string) config('app.key')), 300, function () use ($url, $network): string {
            try {
                $start = hrtime(true);
                $host = parse_url($url, PHP_URL_HOST);
                $ips = $this->probe->resolve($host);
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
                $status = $this->probe->head($url, $host, $ips[0], $remaining);
                if ($status === 410 || ($network === 'github' && $status === 404)) {
                    return 'invalid';
                }
                // A bare 200 or an ambiguous provider-specific 404 is not
                // evidence of a particular profile's existence. Fail open only
                // for the availability classification; the URL is still validated.
            } catch (Throwable) {
                // Never log URL or remote content.
            }

            return 'inconclusive';
        });
    }
}
