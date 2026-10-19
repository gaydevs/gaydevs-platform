<?php

use App\Enums\OtpAttemptResult;
use App\Models\AuthenticatedSession;
use App\Models\OtpRequest;
use App\Models\VisitorObservation;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('otp dependencies must be removed explicitly', function () {
    $otp = OtpRequest::factory()->create();

    expect(fn () => $otp->user->delete())->toThrow(QueryException::class)
        ->and(fn () => $otp->visitorObservation->delete())->toThrow(QueryException::class);
});

test('authentication attribution dependencies must be removed explicitly', function () {
    $otp = OtpRequest::factory()->create();
    $token = $otp->user->createToken('test')->accessToken;
    $authenticatedSession = AuthenticatedSession::factory()->for($otp->user)->create();
    VisitorObservation::factory()->create([
        'personal_access_token_id' => $token->id,
    ]);
    VisitorObservation::factory()->create([
        'authenticated_session_id' => $authenticatedSession->id,
    ]);

    expect(fn () => $token->delete())->toThrow(QueryException::class)
        ->and(fn () => $authenticatedSession->delete())->toThrow(QueryException::class);
});

test('otp supersession audit dependencies must be removed explicitly', function () {
    $current = OtpRequest::factory()->create();
    $superseded = OtpRequest::factory()
        ->for($current->user)
        ->supersededBy($current)
        ->create();

    expect(fn () => $current->delete())->toThrow(QueryException::class);

    $attempt = $current->attempts()->create([
        'matched_otp_request_id' => $superseded->id,
        'visitor_observation_id' => $current->visitor_observation_id,
        'result' => OtpAttemptResult::Superseded,
        'attempted_at' => now(),
    ]);

    expect(fn () => $attempt->matchedOtpRequest->delete())->toThrow(QueryException::class);
});
