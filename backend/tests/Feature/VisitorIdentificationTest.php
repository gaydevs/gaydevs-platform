<?php

use App\Models\IpAddress;
use App\Models\Visitor;
use App\Models\VisitorObservation;
use App\Services\VisitorIdentifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

uses(RefreshDatabase::class);

test('the backend cookie reuses a visitor and visit while observations stay append only', function () {
    $request = Request::create('/ping', 'GET', server: [
        'REMOTE_ADDR' => '198.51.100.42',
        'HTTP_USER_AGENT' => 'Mozilla/5.0 Firefox/143.0',
        'HTTP_ACCEPT_LANGUAGE' => 'pt-BR,pt;q=0.9',
    ]);
    $service = app(VisitorIdentifier::class);
    $first = $service->identify($request);
    $visitorId = $first->visit->visitor_id;

    $secondRequest = Request::create('/auth/otp', 'POST', cookies: [
        VisitorIdentifier::VISITOR_COOKIE => Crypt::encryptString($visitorId),
    ], server: [
        'REMOTE_ADDR' => '198.51.100.42',
        'HTTP_USER_AGENT' => 'Mozilla/5.0 Firefox/143.0',
    ]);
    $second = $service->identify($secondRequest);

    expect($second->visit->is($first->visit))->toBeTrue()
        ->and(Visitor::query()->count())->toBe(1)
        ->and(VisitorObservation::query()->count())->toBe(2)
        ->and(IpAddress::query()->count())->toBe(1)
        ->and(IpAddress::query()->first()->geolocations)->toHaveCount(1)
        ->and($second->browser)->toBe('Firefox');
});

test('records ipv6 independently from the visitor identity', function () {
    $request = Request::create('/ping', 'GET', server: [
        'REMOTE_ADDR' => '2001:db8:abcd:1234::42',
        'HTTP_USER_AGENT' => 'Mozilla/5.0 Firefox/143.0',
    ]);

    $observation = app(VisitorIdentifier::class)->identify($request);

    expect($observation->ipGeolocation->ipAddress->ip)->toBe('2001:db8:abcd:1234::42');
});

test('requests without an ip still produce an observation', function () {
    $request = Request::create('/ping');
    $request->server->remove('REMOTE_ADDR');

    $observation = app(VisitorIdentifier::class)->identify($request);

    expect($observation->ip_geolocation_id)->toBeNull()
        ->and(VisitorObservation::query()->count())->toBe(1)
        ->and(IpAddress::query()->count())->toBe(0);
});
