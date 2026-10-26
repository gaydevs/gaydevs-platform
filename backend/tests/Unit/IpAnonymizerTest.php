<?php

namespace Tests\Unit;

use App\Services\IpAnonymizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class IpAnonymizerTest extends TestCase
{
    /** @return array<string, array{string, string}> */
    public static function addresses(): array
    {
        return [
            'IPv4 /24' => ['192.0.2.129', '192.0.2.0'],
            'IPv6 /48' => ['2001:db8:abcd:1234::1', '2001:db8:abcd::'],
        ];
    }

    #[DataProvider('addresses')]
    public function test_it_anonymizes_the_address(string $address, string $expected): void
    {
        self::assertSame($expected, (new IpAnonymizer)->anonymize($address));
    }
}
