<?php

use App\Exceptions\GeoIpUpdateException;
use App\Services\GeoIp\GeoIpDatabaseDownloader;
use App\Services\GeoIp\GeoIpDatabaseUpdater;
use App\Services\GeoIp\GeoIpDatabaseValidator;
use App\Services\GeoIp\MaxMindGeoIpDatabaseDownloader;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

uses(TestCase::class);

test('maxmind downloader streams a database archive and authenticates without exposing credentials', function () {
    config([
        'geoip.account_id' => 'account-test',
        'geoip.license_key' => 'license-test',
        'geoip.download_base_url' => 'https://maxmind.test/geoip/databases',
    ]);
    Http::fake([
        'https://maxmind.test/*' => Http::response('archive-content', 200),
    ]);
    $destination = tempnam(sys_get_temp_dir(), 'geoip-archive-');

    app(MaxMindGeoIpDatabaseDownloader::class)->download('GeoLite2-City', $destination);

    expect(file_get_contents($destination))->toBe('archive-content');
    Http::assertSent(function ($request): bool {
        $authorization = $request->header('Authorization')[0] ?? '';

        return $request->url() === 'https://maxmind.test/geoip/databases/GeoLite2-City/download?suffix=tar.gz'
            && str_starts_with($authorization, 'Basic ')
            && ! str_contains($request->body(), 'license-test');
    });
    unlink($destination);
});

test('maxmind downloader converts transport and http failures to a safe domain exception', function () {
    config([
        'geoip.account_id' => 'account-test',
        'geoip.license_key' => 'license-test',
        'geoip.download_base_url' => 'https://maxmind.test/geoip/databases',
    ]);
    Http::fake([
        'https://maxmind.test/*' => Http::response([], 401),
    ]);
    $destination = tempnam(sys_get_temp_dir(), 'geoip-archive-');

    expect(fn () => app(MaxMindGeoIpDatabaseDownloader::class)->download('GeoLite2-City', $destination))
        ->toThrow(GeoIpUpdateException::class, 'A MaxMind recusou o download');

    @unlink($destination);
});

test('maxmind downloader retries transient responses with configured limits', function () {
    config([
        'geoip.account_id' => 'account-test',
        'geoip.license_key' => 'license-test',
        'geoip.download_base_url' => 'https://maxmind.test/geoip/databases',
        'geoip.download_retry_attempts' => 2,
        'geoip.download_retry_sleep_milliseconds' => 0,
    ]);
    Http::fake([
        'https://maxmind.test/*' => Http::sequence()
            ->pushStatus(503)
            ->push('archive-content', 200),
    ]);
    $destination = tempnam(sys_get_temp_dir(), 'geoip-archive-');

    app(MaxMindGeoIpDatabaseDownloader::class)->download('GeoLite2-City', $destination);

    expect(file_get_contents($destination))->toBe('archive-content');
    Http::assertSentCount(2);
    @unlink($destination);
});

test('geoip updater extracts mocked archives and replaces both databases only after validation', function () {
    $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gaydevs-geoip-test-'.Str::uuid();
    $databaseDirectory = $root.DIRECTORY_SEPARATOR.'databases';
    mkdir($databaseDirectory, 0750, true);
    $cityPath = $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-City.mmdb';
    $asnPath = $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-ASN.mmdb';
    file_put_contents($cityPath, 'old-city');
    file_put_contents($asnPath, 'old-asn');
    config([
        'geoip.database_directory' => $databaseDirectory,
        'geoip.city_database' => $cityPath,
        'geoip.asn_database' => $asnPath,
        'geoip.max_age_days' => 30,
    ]);

    $createArchive = static function (string $destination, string $filename, string $content): void {
        $sourceDirectory = dirname($destination).DIRECTORY_SEPARATOR.'source-'.Str::uuid();
        mkdir($sourceDirectory.DIRECTORY_SEPARATOR.'GeoLite2-test', 0750, true);
        file_put_contents($sourceDirectory.DIRECTORY_SEPARATOR.'GeoLite2-test'.DIRECTORY_SEPARATOR.$filename, $content);

        try {
            (new Process([
                'tar',
                '-czf',
                $destination,
                '-C',
                $sourceDirectory,
                'GeoLite2-test',
            ]))->mustRun();
        } finally {
            File::deleteDirectory($sourceDirectory);
        }
    };
    $downloader = Mockery::mock(GeoIpDatabaseDownloader::class);
    $downloader->shouldReceive('download')->twice()->andReturnUsing(
        function (string $edition, string $destination) use ($createArchive): void {
            $filename = $edition === 'GeoLite2-City' ? 'GeoLite2-City.mmdb' : 'GeoLite2-ASN.mmdb';
            $createArchive($destination, $filename, 'new-'.$edition);
        },
    );
    $validator = Mockery::mock(GeoIpDatabaseValidator::class);
    $validator->shouldReceive('validate')->twice()->andReturnUsing(
        fn (string $path, string $expectedType): array => [
            'type' => 'GeoLite2-'.$expectedType,
            'built_at' => CarbonImmutable::now()->subDay(),
        ],
    );
    app()->instance(GeoIpDatabaseDownloader::class, $downloader);
    app()->instance(GeoIpDatabaseValidator::class, $validator);

    try {
        $result = app(GeoIpDatabaseUpdater::class)->update();

        expect(file_get_contents($cityPath))->toBe('new-GeoLite2-City')
            ->and(file_get_contents($asnPath))->toBe('new-GeoLite2-ASN')
            ->and($result['City']['type'])->toBe('GeoLite2-City')
            ->and($result['ASN']['type'])->toBe('GeoLite2-ASN')
            ->and(glob($databaseDirectory.DIRECTORY_SEPARATOR.'.geoip-update-*'))->toBe([]);
    } finally {
        File::deleteDirectory($root);
    }
});

test('geoip updater keeps current databases when a downloaded archive is invalid', function () {
    $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gaydevs-geoip-test-'.Str::uuid();
    $databaseDirectory = $root.DIRECTORY_SEPARATOR.'databases';
    mkdir($databaseDirectory, 0750, true);
    $cityPath = $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-City.mmdb';
    $asnPath = $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-ASN.mmdb';
    file_put_contents($cityPath, 'old-city');
    file_put_contents($asnPath, 'old-asn');
    config([
        'geoip.database_directory' => $databaseDirectory,
        'geoip.city_database' => $cityPath,
        'geoip.asn_database' => $asnPath,
    ]);
    $downloader = Mockery::mock(GeoIpDatabaseDownloader::class);
    $downloader->shouldReceive('download')->once()->andReturnUsing(
        fn (string $edition, string $destination): int => file_put_contents($destination, 'not-an-archive'),
    );
    app()->instance(GeoIpDatabaseDownloader::class, $downloader);

    try {
        expect(fn () => app(GeoIpDatabaseUpdater::class)->update())
            ->toThrow(GeoIpUpdateException::class, 'não pôde ser extraído');
        expect(file_get_contents($cityPath))->toBe('old-city')
            ->and(file_get_contents($asnPath))->toBe('old-asn');
    } finally {
        File::deleteDirectory($root);
    }
});

test('geoip updater refuses an overlapping run before downloading', function () {
    $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gaydevs-geoip-test-'.Str::uuid();
    $databaseDirectory = $root.DIRECTORY_SEPARATOR.'databases';
    mkdir($databaseDirectory, 0750, true);
    $lockPath = $databaseDirectory.DIRECTORY_SEPARATOR.'.geoipupdate.lock';
    $handle = fopen($lockPath, 'c');
    flock($handle, LOCK_EX | LOCK_NB);
    config([
        'geoip.database_directory' => $databaseDirectory,
        'geoip.city_database' => $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-City.mmdb',
        'geoip.asn_database' => $databaseDirectory.DIRECTORY_SEPARATOR.'GeoLite2-ASN.mmdb',
    ]);
    $downloader = Mockery::mock(GeoIpDatabaseDownloader::class);
    $downloader->shouldReceive('download')->never();
    app()->instance(GeoIpDatabaseDownloader::class, $downloader);

    try {
        expect(fn () => app(GeoIpDatabaseUpdater::class)->update())
            ->toThrow(GeoIpUpdateException::class, 'atualização GeoIP em andamento');
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
        File::deleteDirectory($root);
    }
});
