<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

test('unexpected api failures are generic and correlated with the operational log', function () {
    $logPath = storage_path('logs/api-exception-test.log');
    @unlink($logPath);
    config()->set('logging.channels.operational', [
        'driver' => 'single',
        'path' => $logPath,
        'level' => 'error',
    ]);
    Log::forgetChannel('operational');

    Route::middleware('api')->get('/_test/unexpected-api-failure', function (): never {
        throw new RuntimeException('sensitive database detail');
    });

    $response = $this->getJson('/_test/unexpected-api-failure')
        ->assertInternalServerError()
        ->assertJsonStructure(['message', 'reference'])
        ->assertJsonPath('message', 'Erro interno do servidor.')
        ->assertJsonMissing(['message' => 'sensitive database detail']);

    expect($response->headers->get('X-Request-ID'))
        ->toBe($response->json('reference'))
        ->and(file_get_contents($logPath))
        ->toContain('api.unhandled_exception')
        ->toContain($response->json('reference'))
        ->toContain('sensitive database detail');

    @unlink($logPath);
});
