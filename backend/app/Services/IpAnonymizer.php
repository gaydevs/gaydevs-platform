<?php

namespace App\Services;

class IpAnonymizer
{
    private const IPV4_PACKED_BYTES = 4;

    private const IPV4_HOST_BYTE = 4;

    private const IPV6_FIRST_HOST_BYTE = 7;

    private const IPV6_PACKED_BYTES = 16;

    public function anonymize(string $ip): string
    {
        $packed = @inet_pton($ip);

        if ($packed === false) {
            return $ip;
        }

        $bytes = unpack('C*', $packed);

        if (strlen($packed) === self::IPV4_PACKED_BYTES) {
            $bytes[self::IPV4_HOST_BYTE] = 0;
        } else {
            for ($index = self::IPV6_FIRST_HOST_BYTE; $index <= self::IPV6_PACKED_BYTES; $index++) {
                $bytes[$index] = 0;
            }
        }

        return (string) inet_ntop(pack('C*', ...array_values($bytes)));
    }
}
