<?php

namespace App\Services;

class EmailMasker
{
    public function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        [$domainName, $suffix] = array_pad(explode('.', $domain, 2), 2, '');

        return $this->maskPart($local).'@'.$this->maskPart($domainName).($suffix === '' ? '' : '.'.$suffix);
    }

    private function maskPart(string $value): string
    {
        if ($value === '') {
            return '***';
        }

        return mb_substr($value, 0, 1).str_repeat('*', max(3, mb_strlen($value) - 1));
    }
}
