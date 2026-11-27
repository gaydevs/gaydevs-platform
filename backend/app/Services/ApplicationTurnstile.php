<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class ApplicationTurnstile
{
    public function verify(string $token, ?string $ip): void
    {
        try {
            $response = Http::asForm()->timeout(5)->connectTimeout(2)->withoutRedirecting()
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => config('applications.turnstile.secret'),
                    'response' => $token,
                    'remoteip' => $ip,
                ]);
            $valid = $response->successful() && $response->json('success') === true
                && $response->json('hostname') === config('applications.turnstile.hostname')
                && $response->json('action') === config('applications.turnstile.action');
        } catch (Throwable) {
            $valid = false;
        }

        if (! $valid) {
            throw new HttpException(422, 'Não foi possível validar a proteção antispam.');
        }
    }
}
