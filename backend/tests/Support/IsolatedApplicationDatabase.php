<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * A disposable schema for migrations and multi-process tests; never reuse the
 * database under test, and never create/drop a schema on an arbitrary host.
 */
final class IsolatedApplicationDatabase
{
    public readonly string $driver;

    public readonly string $database;

    private readonly string $original;

    private readonly array $settings;

    public function __construct(private readonly string $connection, string $sqliteDatabase)
    {
        $this->original = DB::getDefaultConnection();
        $this->driver = $this->original === 'mysql' && getenv('GITHUB_ACTIONS') === 'true' && getenv('CI') === 'true' ? 'mysql' : 'sqlite';
        if ($this->driver === 'mysql') {
            $base = config('database.connections.mysql');
            if (! app()->environment('testing') || $base['host'] !== '127.0.0.1'
                || (string) $base['port'] !== '3306' || $base['database'] !== 'testing'
                || ! empty($base['url']) || ! empty($base['unix_socket'])) {
                throw new RuntimeException('MySQL application integration requires a disposable localhost CI service.');
            }
            $this->database = 'gdev_apps_test_'.bin2hex(random_bytes(8));
            $this->settings = [...$base, 'database' => $this->database];
            DB::connection($this->original)->statement('CREATE DATABASE `'.$this->database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } else {
            $this->database = $sqliteDatabase;
            $this->settings = [...config('database.connections.sqlite'), 'database' => $sqliteDatabase, 'url' => null, 'foreign_key_constraints' => true];
        }
        config(['database.connections.'.$connection => $this->settings]);
        DB::setDefaultConnection($connection);
        Schema::clearResolvedInstance('db.schema');
    }

    public function workerEnvironment(): array
    {
        return [
            'DB_CONNECTION' => $this->driver,
            'DB_DATABASE' => $this->database,
            'DB_URL' => '',
            'DB_SOCKET' => '',
            'DB_HOST' => $this->settings['host'] ?? '127.0.0.1',
            'DB_PORT' => (string) ($this->settings['port'] ?? 3306),
            'DB_USERNAME' => $this->settings['username'] ?? '',
            'DB_PASSWORD' => $this->settings['password'] ?? '',
            'APPLICATION_MYSQL_CI' => $this->driver === 'mysql' ? '1' : '0',
            'DB_CACHE_CONNECTION' => $this->driver,
            'DB_CACHE_LOCK_CONNECTION' => $this->driver,
        ];
    }

    public function close(): void
    {
        DB::setDefaultConnection($this->original);
        Schema::clearResolvedInstance('db.schema');
        DB::purge($this->connection);
        if ($this->driver === 'mysql') {
            DB::connection($this->original)->statement('DROP DATABASE `'.$this->database.'`');
        }
    }
}
