<?php

use App\Models\IpAddress;
use App\Models\IpGeolocation;
use App\Services\GeoIp\IpGeolocationUpdater;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Luvittor\GeoIpUpdater\Contract\DatabaseValidator;
use Luvittor\GeoIpUpdater\Contract\Transport;
use Luvittor\GeoIpUpdater\Exception\UpdateException;
use Luvittor\GeoIpUpdater\RemoteDatabase;
use Psr\Log\LoggerInterface;
use Symfony\Component\Process\Process;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->geoipRoot = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gdevs-geoip-package-'.bin2hex(random_bytes(8));
    $directory = $this->geoipRoot.DIRECTORY_SEPARATOR.'databases';

    config([
        'geoip.update_enabled' => true,
        'geoip.account_id' => 'test-account-only',
        'geoip.license_key' => 'test-license-only',
        'geoip.database_directory' => $directory,
        'geoip.city_database' => $directory.DIRECTORY_SEPARATOR.'GeoLite2-City.mmdb',
        'geoip.asn_database' => $directory.DIRECTORY_SEPARATOR.'GeoLite2-ASN.mmdb',
        'geoip.max_age_days' => 30,
        'geoip.warning_age_days' => 7,
    ]);
});

afterEach(function (): void {
    File::deleteDirectory($this->geoipRoot);
});

function installFakeGeoIpTransport(?string $failingEdition = null, ?DateTimeImmutable $builtAt = null): void
{
    $transport = Mockery::mock(Transport::class);
    $transport->shouldReceive('metadata')
        ->andReturnUsing(static fn (string $product): RemoteDatabase => new RemoteDatabase(
            'version-'.substr($product, -3),
            'https://maxmind.invalid/no-request',
        ));
    $transport->shouldReceive('download')
        ->andReturnUsing(static function (RemoteDatabase $database, string $destination) use ($failingEdition): void {
            $edition = str_contains($destination, '/City.tar.gz') ? 'City' : 'ASN';

            if ($edition === $failingEdition) {
                throw new UpdateException('simulated-download-failure');
            }

            $source = dirname($destination).'/source-'.$edition;
            mkdir($source.'/GeoLite2-'.$edition.'_TEST', 0750, true);
            file_put_contents(
                $source.'/GeoLite2-'.$edition.'_TEST/GeoLite2-'.$edition.'.mmdb',
                'fake-'.$edition.'-database',
            );
            try {
                (new Process(['tar', '-czf', $destination, '-C', $source, 'GeoLite2-'.$edition.'_TEST']))->mustRun();
            } finally {
                File::deleteDirectory($source);
            }
        });

    $validator = Mockery::mock(DatabaseValidator::class);
    $validator->shouldReceive('validate')
        ->andReturnUsing(static function (string $path, string $expectedType) use ($builtAt): array {
            if (! is_file($path) || file_get_contents($path) !== 'fake-'.$expectedType.'-database') {
                throw new UpdateException('Invalid database.');
            }

            return [
                'type' => 'GeoLite2-'.$expectedType,
                'builtAt' => $builtAt ?? new DateTimeImmutable('yesterday'),
            ];
        });

    app()->instance(Transport::class, $transport);
    app()->instance(DatabaseValidator::class, $validator);
}

test('the disabled GeoIP command does not resolve the MaxMind transport', function (): void {
    config(['geoip.update_enabled' => false, 'geoip.account_id' => null, 'geoip.license_key' => null]);

    expect(Artisan::call('geoip:update'))->toBe(0)
        ->and(Artisan::output())->toContain('Atualização GeoIP desabilitada.');
});

test('the package adapter installs City and ASN in the configured persistent paths', function (): void {
    installFakeGeoIpTransport();

    expect(Artisan::call('geoip:update'))->toBe(0)
        ->and(Artisan::output())->toContain('(updated)')
        ->and(is_file(config('geoip.city_database')))->toBeTrue()
        ->and(is_file(config('geoip.asn_database')))->toBeTrue()
        ->and(file_get_contents(config('geoip.city_database')))->toBe('fake-City-database')
        ->and(file_get_contents(config('geoip.asn_database')))->toBe('fake-ASN-database');

    expect(Artisan::call('geoip:update'))->toBe(0)
        ->and(Artisan::output())->toContain('(current)');
});

test('successful City and ASN updates reprocess observed IPs only after validation', function (): void {
    $address = IpAddress::factory()->create();
    $geolocation = Mockery::mock(IpGeolocationUpdater::class);
    $geolocation->shouldReceive('update')->once()->withArgs(
        static fn (IpAddress $model, bool $force): bool => $model->is($address) && $force,
    )->andReturn(new IpGeolocation);
    app()->instance(IpGeolocationUpdater::class, $geolocation);
    installFakeGeoIpTransport();

    expect(Artisan::call('geoip:update'))->toBe(0)
        ->and(Artisan::output())->toContain('1 IP(s) reprocessado(s)');
});

test('a failure on ASN leaves both existing databases unchanged and stops IP reprocessing', function (): void {
    $directory = config('geoip.database_directory');
    mkdir($directory, 0750, true);
    file_put_contents(config('geoip.city_database'), 'previous-city');
    file_put_contents(config('geoip.asn_database'), 'previous-asn');
    IpAddress::factory()->create();

    $geolocation = Mockery::mock(IpGeolocationUpdater::class);
    $geolocation->shouldNotReceive('update');
    app()->instance(IpGeolocationUpdater::class, $geolocation);

    installFakeGeoIpTransport('ASN');

    expect(Artisan::call('geoip:update'))->toBe(1)
        ->and(Artisan::output())->toContain('Falha ao atualizar ou validar as bases GeoIP.')
        ->and(file_get_contents(config('geoip.city_database')))->toBe('previous-city')
        ->and(file_get_contents(config('geoip.asn_database')))->toBe('previous-asn');
});

test('a package error does not leak secrets or authorization headers to output or logs', function (): void {
    $secret = 'sensitive-license-test-value';
    $transport = Mockery::mock(Transport::class);
    $transport->shouldReceive('metadata')
        ->andThrow(new UpdateException('Authorization: Basic abc '.$secret));
    $transport->shouldNotReceive('download');
    app()->instance(Transport::class, $transport);

    $logger = Mockery::mock(LoggerInterface::class);
    $logger->shouldReceive('error')->once()->with('geoip.update_failed', [
        'reason' => 'database_update_failed',
    ]);
    Log::shouldReceive('channel')->once()->with('operational')->andReturn($logger);

    $exit = Artisan::call('geoip:update');
    $output = Artisan::output();

    expect($exit)->toBe(1)
        ->and($output)->not->toContain($secret, 'Authorization')
        ->and($output)->toContain('Falha ao atualizar ou validar as bases GeoIP.');
});

test('invalid GeoIP configuration fails without leaking credentials or reprocessing IPs', function (): void {
    config(['geoip.database_directory' => 'relative/path']);
    IpAddress::factory()->create();
    $geolocation = Mockery::mock(IpGeolocationUpdater::class);
    $geolocation->shouldNotReceive('update');
    app()->instance(IpGeolocationUpdater::class, $geolocation);
    installFakeGeoIpTransport();

    expect(Artisan::call('geoip:update'))->toBe(1)
        ->and(Artisan::output())->toContain('Falha ao atualizar ou validar as bases GeoIP.');
});

test('missing credentials fail cleanly only when GeoIP updates are enabled', function (): void {
    config(['geoip.account_id' => '', 'geoip.license_key' => '']);
    expect(Artisan::call('geoip:update'))->toBe(1)
        ->and(Artisan::output())->toContain('Falha ao atualizar ou validar as bases GeoIP.');
});

test('the legacy age warning remains available with validated metadata', function (): void {
    installFakeGeoIpTransport(builtAt: new DateTimeImmutable('-9 days'));

    expect(Artisan::call('geoip:update'))->toBe(0)
        ->and(Artisan::output())->toContain('dias.', 'GeoLite2-City', 'GeoLite2-ASN');
});
