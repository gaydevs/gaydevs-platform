<?php

use App\Models\AuthenticatedSession;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    Route::middleware(['api', 'auth:sanctum'])
        ->get('/_test/protected', fn () => response()->json(['ok' => true]));
    Route::middleware(['web', 'auth:sanctum', 'track.visitor'])
        ->get('/_test/session-protected', fn () => response()->json(['ok' => true]));
});

test('unauthenticated api response is generic', function () {
    $this->getJson('/_test/protected')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'Não autenticado.']);
});

test('authenticated api request attributes its observation to the personal access token', function () {
    $user = User::factory()->create();
    $plainToken = $user->createToken('test')->plainTextToken;

    $this->withHeaders([
        'Authorization' => 'Bearer '.$plainToken,
        'User-Agent' => 'Mozilla/5.0 Firefox/143.0',
    ])->getJson('/_test/protected')->assertOk();

    $observation = VisitorObservation::query()->sole();

    expect($observation->personal_access_token_id)->toBe($user->tokens()->sole()->id)
        ->and($observation->personalAccessToken->is($user->tokens()->sole()))->toBeTrue()
        ->and($observation->authenticated_session_id)->toBeNull();
});

test('authenticated web request attributes its observation to the durable session', function () {
    $user = User::factory()->create();
    $authenticatedSession = AuthenticatedSession::factory()->for($user)->create();

    $this->actingAs($user)
        ->withSession([AuthenticatedSession::SESSION_KEY => $authenticatedSession->id])
        ->getJson('/_test/session-protected')
        ->assertOk();

    $observation = VisitorObservation::query()->sole();

    expect($observation->authenticated_session_id)->toBe($authenticatedSession->id)
        ->and($observation->personal_access_token_id)->toBeNull()
        ->and($authenticatedSession->fresh()->last_seen_at->greaterThanOrEqualTo($authenticatedSession->last_seen_at))->toBeTrue();
});

test('web request does not attribute an ended durable session', function () {
    $user = User::factory()->create();
    $authenticatedSession = AuthenticatedSession::factory()->for($user)->create([
        'ended_at' => now(),
        'end_reason' => 'logout',
    ]);

    $this->actingAs($user)
        ->withSession([AuthenticatedSession::SESSION_KEY => $authenticatedSession->id])
        ->getJson('/_test/session-protected')
        ->assertOk();

    expect(VisitorObservation::query()->sole()->authenticated_session_id)->toBeNull();
});

test('web request does not attribute another user durable session', function () {
    $user = User::factory()->create();
    $anotherSession = AuthenticatedSession::factory()->create();

    $this->actingAs($user)
        ->withSession([AuthenticatedSession::SESSION_KEY => $anotherSession->id])
        ->getJson('/_test/session-protected')
        ->assertOk();

    expect(VisitorObservation::query()->sole()->authenticated_session_id)->toBeNull();
});
