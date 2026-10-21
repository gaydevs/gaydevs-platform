<?php

use App\Models\VisitorObservation;
use App\Services\VisitorIdentifier;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('reports that the API is available', function () {
    $response = $this->get('/ping')
        ->assertOk()
        ->assertSeeText('pong')
        ->assertCookie(VisitorIdentifier::VISITOR_COOKIE);

    $requestId = $response->headers->get('X-Request-ID');

    expect($requestId)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i')
        ->and(VisitorObservation::query()->sole()->request_id)->toBe($requestId);
});
