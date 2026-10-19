<?php

use App\Services\VisitorIdentifier;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('reports that the API is available', function () {
    $this->get('/ping')
        ->assertOk()
        ->assertSeeText('pong')
        ->assertCookie(VisitorIdentifier::VISITOR_COOKIE);
});
