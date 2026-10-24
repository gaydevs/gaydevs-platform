<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user search requires a term and masks the matching name or email prefix contextually', function () {
    User::factory()->create([
        'name' => 'Roberto Souza',
        'email' => 'roberto.sousa@gdevsmail.com',
    ]);
    User::factory()->inactive()->create(['name' => 'Mario Lima']);
    User::factory()->create(['name' => 'Amaro Silva']);

    $this->getJson('/users')->assertOk()->assertExactJson([]);
    $this->getJson('/users?q=')->assertOk()->assertExactJson([]);

    $this->getJson('/users?q=Ro')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', 'Ro***** S****')
        ->assertJsonPath('0.email', 'ro*****.s****@g********.com')
        ->assertJsonMissing(['roberto.sousa@gdevsmail.com']);

    $this->getJson('/users?q=Souz')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', 'R****** Souz*')
        ->assertJsonPath('0.email', 'r******.s****@g********.com');

    $this->getJson('/users?q=roberto.s')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.name', 'Roberto S****')
        ->assertJsonPath('0.email', 'roberto.s****@g********.com');
});

test('user search treats sql wildcard characters as literal input', function () {
    User::factory()->create(['name' => 'Roberto Souza']);

    $this->getJson('/users?q=%')->assertOk()->assertExactJson([]);
    $this->getJson('/users?q=_')->assertOk()->assertExactJson([]);
});

test('user search returns at most five masked results', function () {
    foreach (range(1, 6) as $number) {
        User::factory()->create([
            'name' => "Lucas User {$number}",
            'email' => "lucas{$number}@example.com",
        ]);
    }

    $response = $this->getJson('/users?q=L')->assertOk()->assertJsonCount(5);

    foreach ($response->json() as $result) {
        expect($result)->toHaveKeys(['id', 'name', 'email'])
            ->and($result['name'])->not->toContain('Lucas')
            ->and($result['email'])->not->toContain('@example.com');
    }
});

test('user search rate limit applies across queries from the same ip', function () {
    config([
        'passwordless.rate_limits.search_per_ip.max_attempts' => 2,
        'passwordless.rate_limits.search_per_ip.decay_seconds' => 60,
    ]);
    User::factory()->create(['name' => 'Roberto Souza']);

    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
        ->getJson('/users?q=R')
        ->assertOk();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
        ->getJson('/users?q=Ro')
        ->assertOk();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
        ->getJson('/users?q=Rob')
        ->assertTooManyRequests()
        ->assertExactJson(['message' => 'Muitas tentativas. Tente novamente mais tarde.']);

    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.11'])
        ->getJson('/users?q=Rob')
        ->assertOk();
});
