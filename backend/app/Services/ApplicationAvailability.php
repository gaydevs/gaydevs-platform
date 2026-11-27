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
            || blank($turnstile['action']) || ! filter_var(config('applications.admin_email'), FILTER_VALIDATE_EMAIL)
            || ! preg_match('/^\+?[1-9][0-9]{7,14}$/D', (string) config('applications.whatsapp'))
            || blank(config('app.key'))
            || (app()->environment('production') && (
                in_array(config('mail.default'), ['log', 'array'], true)
                || config('applications.approved_terms_version') !== ApplicationTerms::VERSION
                || ! filter_var(config('applications.platform_url'), FILTER_VALIDATE_URL)
                || parse_url((string) config('applications.platform_url'), PHP_URL_SCHEME) !== 'https'
            ))) {
            Log::channel('operational')->error('applications.configuration_invalid');
            throw new HttpException(503, 'Cadastro temporariamente indisponível.');
        }
    }

    public function whatsapp(): string
    {
        return 'https://wa.me/'.ltrim((string) config('applications.whatsapp'), '+');
    }
}
