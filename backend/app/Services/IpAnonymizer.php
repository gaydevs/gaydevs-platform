<?php

namespace App\Services;

class IpAnonymizer
{
    public function anonymize(string $ip): string
    {
        $packed = @inet_pton($ip);

        if ($packed === false) {
            return $ip;
        }

        $bytes = unpack('C*', $packed);

        if (strlen($packed) === 4) {
            $bytes[4] = 0;
        } else {
            for ($index = 7; $index <= 16; $index++) {
                $bytes[$index] = 0;
            }
        }

        return (string) inet_ntop(pack('C*', ...array_values($bytes)));
    }
}
