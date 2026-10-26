<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DevelopmentUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('the local database seeder creates deterministic development users idempotently', function () {
    $this->app->instance('env', 'local');
    config()->set('development.seed_enabled', true);

    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    $domains = User::query()->pluck('email')
        ->map(fn (string $email): string => str($email)->after('@')->toString())
        ->unique();

    expect(User::query()->count())->toBe(10)
        ->and($domains)->toHaveCount(10)
        ->and(User::query()->where('email', 'alex.dev@frontend.test')->sole()->status)
        ->toBe(User::STATUS_ACTIVE)
        ->and(User::query()->where('email', 'bruno.backend@backend.test')->sole()->status)
        ->toBe(User::STATUS_ACTIVE)
        ->and(User::query()->where('email', 'caio.inativo@qa.test')->sole()->status)
        ->toBe(User::STATUS_INACTIVE);
});

test('the development user seeder does not populate production', function () {
    $this->app->instance('env', 'production');
    config()->set('development.seed_enabled', true);

    $this->artisan('db:seed', [
        '--class' => DevelopmentUserSeeder::class,
        '--force' => true,
    ])->assertSuccessful();

    expect(User::query()->count())->toBe(0);
});
