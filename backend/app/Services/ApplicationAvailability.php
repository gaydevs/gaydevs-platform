<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ApplicationAvailability
{
    public function ensure(): void
    {
        $turnstile = config('applications.turnstile');
        if (blank($turnstile['sitekey']) || blank($turnstile['secret']) || blank($turnstile['hostname'])
            || blank($turnstile['action']) || ! filter_var(config('mail.from.address'), FILTER_VALIDATE_EMAIL)
            || ! preg_match('/^\+?[1-9][0-9]{7,14}$/D', (string) config('applications.support_whatsapp'))
            || blank(config('app.key'))
            || ! ApplicationTurnstile::credentialsAllowed()
            || ! self::frontendUrlConfigured((string) config('app.frontend_url'))
            || (app()->environment('production') && (
                in_array(config('mail.default'), ['log', 'array'], true)
                || ! ApplicationTerms::FINALIZED
                || config('applications.turnstile.test_mode')
            ))) {
            Log::channel('operational')->error('applications.configuration_invalid');
            throw new HttpException(503, 'Cadastro temporariamente indisponível.');
        }
    }

    public static function frontendUrlConfigured(string $url): bool
    {
        return trim($url) !== '';
    }

    public function whatsapp(): string
    {
        return 'https://wa.me/'.ltrim((string) config('applications.support_whatsapp'), '+');
    }
}
