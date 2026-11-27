<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ApplicationAvailability
{
    public function ensure(): void
    {
        if (! config('applications.enabled')) {
            throw new HttpException(503, 'Cadastro temporariamente indisponível.');
        }
        $turnstile = config('applications.turnstile');
        if (blank($turnstile['sitekey']) || blank($turnstile['secret']) || blank($turnstile['hostname'])
            || blank($turnstile['action']) || ! filter_var(config('mail.from.address'), FILTER_VALIDATE_EMAIL)
            || ! preg_match('/^\+?[1-9][0-9]{7,14}$/D', (string) config('applications.support_whatsapp'))
            || blank(config('app.key'))
            || ! ApplicationTurnstile::credentialsAllowed()
            || ! self::validFrontendUrl((string) config('app.frontend_url'))
            || (app()->environment('production') && (
                in_array(config('mail.default'), ['log', 'array'], true)
                || ! ApplicationTerms::FINALIZED
            ))) {
            Log::channel('operational')->error('applications.configuration_invalid');
            throw new HttpException(503, 'Cadastro temporariamente indisponível.');
        }
    }

    public static function validFrontendUrl(string $url): bool
    {
        if (! filter_var($url, FILTER_VALIDATE_URL)
            || parse_url($url, PHP_URL_USER) !== null
            || parse_url($url, PHP_URL_PASS) !== null
            || parse_url($url, PHP_URL_QUERY) !== null
            || parse_url($url, PHP_URL_FRAGMENT) !== null) {
            return false;
        }

        return parse_url($url, PHP_URL_SCHEME) === 'https'
            || (app()->environment('local', 'testing')
                && parse_url($url, PHP_URL_SCHEME) === 'http'
                && in_array(parse_url($url, PHP_URL_HOST), ['localhost', '127.0.0.1', '[::1]'], true));
    }

    public function whatsapp(): string
    {
        return 'https://wa.me/'.ltrim((string) config('applications.support_whatsapp'), '+');
    }
}
