<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class ApplicationTurnstile
{
    public static function credentialsAllowed(): bool
    {
        $site = (string) config('applications.turnstile.sitekey');
        $secret = (string) config('applications.turnstile.secret');
        $testSite = preg_match('/^[123]x0{20}(AA|AB|BB|FF)$/D', $site) === 1;
        $testSecret = preg_match('/^[123]x0{31}AA$/D', $secret) === 1;
        if (config('applications.turnstile.test_mode')) {
            return $testSite && $testSecret;
        }

        return ! $testSite && ! $testSecret;
    }

    public function verify(string $token, ?string $ip): void
    {
        $valid = false;
        if (self::credentialsAllowed()) {
            try {
                $response = Http::asForm()->timeout(5)->connectTimeout(2)->withoutRedirecting()
                    ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                        'secret' => config('applications.turnstile.secret'),
                        'response' => $token,
                        'remoteip' => $ip,
                    ]);
                $valid = $response->successful() && $response->json('success') === true;
                if (config('applications.turnstile.test_mode')) {
                    // Dummy Siteverify returns example.com with no action.
                    // Still require actual Siteverify success; never enable in production.
                    $valid = $valid && $response->json('hostname') === 'example.com'
                        && $response->json('action') === null;
                } else {
                    $valid = $valid && $response->json('hostname') === config('applications.turnstile.hostname')
                        && $response->json('action') === config('applications.turnstile.action');
                }
            } catch (Throwable) {
                $valid = false;
            }
        }

        if (! $valid) {
            throw new HttpException(422, 'Não foi possível validar a proteção antispam.');
        }
    }
}
