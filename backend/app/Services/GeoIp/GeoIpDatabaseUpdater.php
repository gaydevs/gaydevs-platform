<?php

namespace App\Services\GeoIp;

use App\Exceptions\GeoIpUpdateException;
use Carbon\CarbonImmutable;
use FilesystemIterator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PharData;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

class GeoIpDatabaseUpdater
{
    /** @var array<string, array{path: string|null, type: string}> */
    private array $databases;

    public function __construct(
        private readonly GeoIpDatabaseDownloader $downloader,
        private readonly GeoIpDatabaseValidator $validator,
    ) {
        $this->databases = [
            'City' => [
                'path' => config('geoip.city_database'),
                'type' => 'City',
            ],
            'ASN' => [
                'path' => config('geoip.asn_database'),
                'type' => 'ASN',
            ],
        ];
    }

    /** @return array<string, array{path: string, type: string, built_at: CarbonImmutable, staged_path: string}> */
    public function update(): array
    {
        $directory = $this->prepareDatabaseDirectory();

        $lockPath = config('geoip.update_lock_file')
            ?: $directory.DIRECTORY_SEPARATOR.'.geoipupdate.lock';
        $lock = $this->acquireLock($lockPath);
        $staging = $directory.DIRECTORY_SEPARATOR.'.geoip-update-'.Str::uuid();

        try {
            if (! mkdir($staging, 0750, true) && ! is_dir($staging)) {
                throw new GeoIpUpdateException('Não foi possível criar o diretório temporário do GeoIP.');
            }

            $prepared = $this->prepare($staging);
            $this->install($prepared);

            return $prepared;
        } catch (GeoIpUpdateException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            throw new GeoIpUpdateException('A atualização das bases GeoIP falhou.', previous: $exception);
        } finally {
            $this->removeDirectory($staging);
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function prepareDatabaseDirectory(): string
    {
        $directory = config('geoip.database_directory');

        if (! is_string($directory) || trim($directory) === '') {
            throw new GeoIpUpdateException('O diretório das bases GeoIP não está configurado.');
        }

        if (! $this->isAbsolutePath($directory)) {
            throw new GeoIpUpdateException('O diretório das bases GeoIP deve usar um caminho absoluto.');
        }

        if (file_exists($directory) && ! is_dir($directory)) {
            throw new GeoIpUpdateException('O caminho configurado para as bases GeoIP não é um diretório.');
        }

        if (! is_dir($directory) && ! mkdir($directory, 0750, true) && ! is_dir($directory)) {
            throw new GeoIpUpdateException('Não foi possível criar o diretório das bases GeoIP.');
        }

        if (! is_writable($directory)) {
            throw new GeoIpUpdateException('O diretório das bases GeoIP não permite escrita.');
        }

        return $directory;
    }

    private function isAbsolutePath(string $path): bool
    {
        if (DIRECTORY_SEPARATOR === '/') {
            return str_starts_with($path, '/');
        }

        return str_starts_with($path, '\\')
            || preg_match('/^[A-Za-z]:[\\\/]/', $path) === 1;
    }

    /** @return array<string, array{path: string, type: string, built_at: CarbonImmutable}> */
    private function prepare(string $staging): array
    {
        $prepared = [];

        foreach ($this->databases as $edition => $database) {
            $path = $database['path'];

            if (! is_string($path) || ! is_dir(dirname($path))) {
                throw new GeoIpUpdateException("O caminho da base GeoIP {$edition} não está configurado.");
            }

            $archive = $staging.DIRECTORY_SEPARATOR.$edition.'.tar.gz';
            $this->downloader->download('GeoLite2-'.$edition, $archive);

            $extractDirectory = $staging.DIRECTORY_SEPARATOR.$edition;
            $this->extract($archive, $extractDirectory);
            $databasePath = $this->findDatabase($extractDirectory, basename($path));
            $stagedPath = $staging.DIRECTORY_SEPARATOR.basename($path);

            if (! copy($databasePath, $stagedPath)) {
                throw new GeoIpUpdateException("Não foi possível preparar a base GeoIP {$edition}.");
            }

            $metadata = $this->validator->validate($stagedPath, $database['type']);
            $age = $metadata['built_at']->diffInDays(now());

            if ($age > (int) config('geoip.max_age_days')) {
                throw new GeoIpUpdateException("A base GeoIP {$edition} excede a idade máxima ({$age} dias).");
            }

            $prepared[$edition] = [
                'path' => $path,
                'type' => $metadata['type'],
                'built_at' => $metadata['built_at'],
                'staged_path' => $stagedPath,
            ];
        }

        return $prepared;
    }

    /** @param array<string, array{path: string, type: string, built_at: CarbonImmutable, staged_path: string}> $prepared */
    private function install(array $prepared): void
    {
        $backups = [];
        $installed = [];

        try {
            foreach ($prepared as $database) {
                $target = $database['path'];
                $temporary = $target.'.new-'.Str::uuid();

                if (! copy($database['staged_path'], $temporary)) {
                    throw new GeoIpUpdateException('Não foi possível copiar uma base GeoIP para instalação.');
                }

                $backup = $target.'.previous-'.Str::uuid();
                if (is_file($target) && ! copy($target, $backup)) {
                    @unlink($temporary);
                    throw new GeoIpUpdateException('Não foi possível preservar a base GeoIP vigente.');
                }

                $backups[$target] = is_file($backup) ? $backup : null;

                if (DIRECTORY_SEPARATOR === '\\' && is_file($target)) {
                    @unlink($target);
                }

                if (! rename($temporary, $target)) {
                    @unlink($temporary);
                    throw new GeoIpUpdateException('Não foi possível instalar uma base GeoIP.');
                }

                $installed[] = $target;
            }
        } catch (Throwable $exception) {
            foreach ($installed as $target) {
                @unlink($target);
            }

            foreach ($backups as $target => $backup) {
                if (is_string($backup) && is_file($backup)) {
                    @rename($backup, $target);
                }
            }

            if ($exception instanceof GeoIpUpdateException) {
                throw $exception;
            }

            throw new GeoIpUpdateException('Não foi possível instalar as bases GeoIP.', previous: $exception);
        } finally {
            foreach ($backups as $backup) {
                if (is_string($backup)) {
                    @unlink($backup);
                }
            }
        }
    }

    private function acquireLock(string $path): mixed
    {
        $lock = @fopen($path, 'c');

        if ($lock === false || ! flock($lock, LOCK_EX | LOCK_NB)) {
            if (is_resource($lock)) {
                fclose($lock);
            }

            Log::channel('operational')->warning('geoip.update_skipped', [
                'reason' => 'overlapping',
            ]);

            throw new GeoIpUpdateException('Já existe uma atualização GeoIP em andamento.');
        }

        return $lock;
    }

    private function extract(string $archive, string $destination): void
    {
        if (! mkdir($destination, 0750, true) && ! is_dir($destination)) {
            throw new GeoIpUpdateException('Não foi possível criar a área temporária do GeoIP.');
        }

        try {
            $tarPath = substr($archive, 0, -3);
            (new PharData($archive))->decompress();
            (new PharData($tarPath))->extractTo($destination, null, true);
        } catch (Throwable $exception) {
            throw new GeoIpUpdateException('O pacote baixado do GeoIP não pôde ser extraído.', previous: $exception);
        }
    }

    private function findDatabase(string $directory, string $filename): string
    {
        $root = realpath($directory);
        if ($root === false) {
            throw new GeoIpUpdateException('A área extraída do GeoIP não existe.');
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        );

        foreach ($iterator as $file) {
            if (! $file->isFile() || $file->getFilename() !== $filename) {
                continue;
            }

            $path = realpath($file->getPathname());
            if ($path !== false && str_starts_with($path, $root.DIRECTORY_SEPARATOR)) {
                return $path;
            }
        }

        throw new GeoIpUpdateException("O pacote GeoIP não contém {$filename}.");
    }

    private function removeDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $file) {
            $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
        }

        @rmdir($directory);
    }
}
