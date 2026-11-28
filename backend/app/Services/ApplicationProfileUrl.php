<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class ApplicationProfileUrl
{
    private const HOSTS = ['linkedin' => 'linkedin.com', 'github' => 'github.com', 'instagram' => 'instagram.com'];

    public function normalize(string $network, ?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $host = self::HOSTS[$network] ?? throw new \InvalidArgumentException('Unknown profile provider.');
        $value = trim($value);
        $prefix = $network === 'linkedin' ? 'in/' : '';
        if (str_contains($value, '/') || str_contains($value, ':')) {
            if (! str_contains($value, '://')) {
                $value = 'https://'.$value;
            }
            $parts = parse_url($value);
            if ($parts === false || ($parts['scheme'] ?? '') !== 'https'
                || ! in_array(strtolower($parts['host'] ?? ''), [$host, 'www.'.$host], true)
                || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])
                || isset($parts['query']) || isset($parts['fragment'])) {
                $this->invalid($network);
            }
            $path = trim($parts['path'] ?? '', '/');
            if ($prefix !== '' && ! str_starts_with($path, $prefix)) {
                $this->invalid($network);
            }
            $value = substr($path, strlen($prefix));
        } else {
            $value = ltrim($value, '@');
        }
        $pattern = match ($network) {
            'github' => '/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/D',
            'instagram' => '/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/D',
            default => '/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/D',
        };
        if (! preg_match($pattern, $value) || str_contains($value, '..')
            || ($network === 'github' && in_array(strtolower($value), ['login', 'join', 'settings', 'explore', 'topics', 'marketplace', 'search', 'features', 'pricing', 'orgs', 'organizations', 'about'], true))
            || ($network === 'instagram' && in_array(strtolower($value), ['accounts', 'explore', 'reels', 'reel', 'stories', 'direct', 'p', 'about'], true))) {
            $this->invalid($network);
        }

        return 'https://'.$host.'/'.$prefix.$value;
    }

    private function invalid(string $network): never
    {
        throw ValidationException::withMessages([$network => 'Informe um identificador ou URL HTTPS de perfil válido.']);
    }
}
