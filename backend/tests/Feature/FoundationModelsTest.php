<?php

use App\Enums\OtpAttemptResult;
use App\Enums\OtpRequestStatus;
use App\Models\AuthenticatedSession;
use App\Models\OtpAttempt;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\Visit;
use App\Models\VisitorObservation;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Ramsey\Uuid\Uuid;

uses(RefreshDatabase::class);

test('public domain ids use uuid v7 while internal ids are integers', function () {
    $otp = OtpRequest::factory()->create();
    $observation = $otp->visitorObservation;

    expect(Uuid::fromString($otp->id)->getFields()->getVersion())->toBe(7)
        ->and(Uuid::fromString($otp->user->id)->getFields()->getVersion())->toBe(7)
        ->and(Uuid::fromString($observation->visit->visitor->id)->getFields()->getVersion())->toBe(7)
        ->and($observation->id)->toBeInt()
        ->and($observation->visit->id)->toBeInt()
        ->and($observation->ipGeolocation->id)->toBeInt()
        ->and($observation->ipGeolocation->ipAddress->id)->toBeInt()
        ->and(AuthenticatedSession::factory()->create()->id)->toBeInt()
        ->and($otp->user->status)->toBe(User::STATUS_ACTIVE)
        ->and($otp->status)->toBe(OtpRequestStatus::Pending)
        ->and($otp->user->otpRequests)->toHaveCount(1)
        ->and($observation->otpRequests)->toHaveCount(1);
});

test('user factory supports inactive status', function () {
    expect(User::factory()->inactive()->create()->status)->toBe(User::STATUS_INACTIVE);
});

test('user status only accepts active or inactive', function () {
    expect(fn () => User::factory()->create(['status' => 'unknown']))
        ->toThrow(QueryException::class);
});

test('authentication visits are derived from their exact observations', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->accessToken;
    $authenticatedSession = AuthenticatedSession::factory()->for($user)->create();
    $visits = Visit::factory()->count(2)->create();

    VisitorObservation::factory()->for($visits[0])->create([
        'authenticated_session_id' => $authenticatedSession->id,
    ]);
    VisitorObservation::factory()->for($visits[1])->create([
        'personal_access_token_id' => $token->id,
    ]);

    expect($authenticatedSession->observations()->distinct()->pluck('visit_id'))->toContain($visits[0]->id)
        ->and(VisitorObservation::query()
            ->where('personal_access_token_id', $token->id)
            ->distinct()
            ->pluck('visit_id'))->toContain($visits[1]->id)
        ->and($user->authenticatedSessions)->toHaveCount(1)
        ->and(Schema::getColumnType('personal_access_tokens', 'tokenable_id'))->toBe('varchar');
});

test('otp attempts preserve already used events and authenticated context', function () {
    $otp = OtpRequest::factory()->create();
    $attempt = OtpAttempt::query()->create([
        'otp_request_id' => $otp->id,
        'visitor_observation_id' => $otp->visitor_observation_id,
        'authenticated_user_id' => $otp->user_id,
        'result' => OtpAttemptResult::AlreadyUsed,
        'attempted_at' => now(),
    ]);

    expect($otp->attempts()->count())->toBe(1)
        ->and($attempt->id)->toBeInt()
        ->and($attempt->authenticatedUser->is($otp->user))->toBeTrue()
        ->and($attempt->result)->toBe(OtpAttemptResult::AlreadyUsed);
});

test('a newer otp preserves which pending request it superseded', function () {
    $user = User::factory()->create();
    $replacement = OtpRequest::factory()->for($user)->create([
        'code_hash' => Hash::make('222222'),
    ]);
    $superseded = OtpRequest::factory()
        ->for($user)
        ->supersededBy($replacement)
        ->create(['code_hash' => Hash::make('111111')]);

    expect($superseded->status)->toBe(OtpRequestStatus::Superseded)
        ->and($superseded->superseded_at)->not->toBeNull()
        ->and($superseded->supersededBy->is($replacement))->toBeTrue()
        ->and($replacement->supersededRequests->sole()->is($superseded))->toBeTrue()
        ->and($superseded->matchesCode('111111'))->toBeTrue()
        ->and($replacement->matchesCode('111111'))->toBeFalse();
});

test('an attempt can preserve the current request and the superseded code it matched', function () {
    $user = User::factory()->create();
    $current = OtpRequest::factory()->for($user)->create();
    $superseded = OtpRequest::factory()->for($user)->supersededBy($current)->create();

    $attempt = OtpAttempt::query()->create([
        'otp_request_id' => $current->id,
        'matched_otp_request_id' => $superseded->id,
        'visitor_observation_id' => $current->visitor_observation_id,
        'result' => OtpAttemptResult::Superseded,
        'attempted_at' => now(),
    ]);

    expect($attempt->otpRequest->is($current))->toBeTrue()
        ->and($attempt->matchedOtpRequest->is($superseded))->toBeTrue()
        ->and($attempt->result)->toBe(OtpAttemptResult::Superseded)
        ->and($current->failed_attempts)->toBe(0);
});

test('otp requests persist only a hidden one-way code hash', function () {
    $otp = OtpRequest::factory()->create([
        'code_hash' => Hash::make('654321'),
    ]);

    expect($otp->matchesCode('654321'))->toBeTrue()
        ->and($otp->toArray())->not->toHaveKey('code_hash')
        ->and(Schema::hasColumn('otp_requests', 'code_hash'))->toBeTrue()
        ->and(Schema::hasColumn('otp_requests', 'code'))->toBeFalse()
        ->and(Schema::hasColumn('otp_requests', 'code_encrypted'))->toBeFalse();
});
