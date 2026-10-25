<?php

use App\Enums\OtpAttemptResult;
use App\Enums\OtpRequestStatus;
use App\Http\Middleware\EnsureUserIsActive;
use App\Mail\LoginOtpMail;
use App\Models\AuthenticatedSession;
use App\Models\OtpAttempt;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\OtpVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    Mail::fake();
    config(['session.driver' => 'database']);
    app('session')->forgetDrivers();

    Route::middleware(['api', 'auth:sanctum', EnsureUserIsActive::class])
        ->get('/_test/passwordless-protected', fn () => response()->json(['ok' => true]));

    $csrfResponse = $this->withHeaders(statefulHeaders())->get('/sanctum/csrf-cookie');
    $csrfCookie = $csrfResponse->getCookie('XSRF-TOKEN', false);
    $csrfResponse->assertNoContent()->assertCookie('XSRF-TOKEN', null, false);
    $this->withHeader('X-XSRF-TOKEN', $csrfCookie->getValue());
});

function issueLoginOtp($test, User $user): array
{
    $response = $test->postJson('/auth/otp', ['user_id' => $user->id])->assertAccepted();
    $mail = Mail::sent(LoginOtpMail::class)->last();

    return [$response->json('otp_request_id'), $mail->code];
}

function statefulHeaders(): array
{
    return [
        'Origin' => 'http://127.0.0.1:5173',
        'Referer' => 'http://127.0.0.1:5173/gaydevs/platform/',
    ];
}

function verifyLoginOtp($test, string $requestId, string $code, ?string $ip = null)
{
    $test->withHeaders(statefulHeaders());
    if ($ip !== null) {
        $test->withServerVariables(['REMOTE_ADDR' => $ip]);
    }

    $response = $test->postJson('/auth/verify', [
        'otp_request_id' => $requestId,
        'code' => $code,
    ]);

    $csrfCookie = $response->getCookie('XSRF-TOKEN', false);
    if ($csrfCookie !== null) {
        $test->withHeader('X-XSRF-TOKEN', $csrfCookie->getValue());
    }

    return $response;
}

function parallelOtpVerificationTask(string $otpRequestId, int $observationId): Closure
{
    return static function () use ($otpRequestId, $observationId): string {
        $observation = VisitorObservation::query()->findOrFail($observationId);

        return app(OtpVerifier::class)->verify(
            $otpRequestId,
            '123456',
            '192.0.2.'.$observationId,
            $observation,
        )->result->value;
    };
}

test('a valid otp creates one stateful database session and an accepted audit event', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);

    $response = verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    $otpRequest = OtpRequest::query()->findOrFail($requestId);
    $attempt = $otpRequest->attempts()->sole();
    $authenticatedSession = AuthenticatedSession::query()->sole();

    $response->assertCookie((string) config('session.cookie'), null, false);
    $this->assertAuthenticatedAs($user);
    $this->withHeaders(statefulHeaders())
        ->getJson('/auth/session')
        ->assertOk()
        ->assertExactJson([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
            ],
        ]);
    $this->withHeaders(statefulHeaders())
        ->getJson('/_test/passwordless-protected')
        ->assertOk()
        ->assertExactJson(['ok' => true]);

    expect($otpRequest->status)->toBe(OtpRequestStatus::Used)
        ->and($otpRequest->accepted_at)->not->toBeNull()
        ->and($attempt->result)->toBe(OtpAttemptResult::Accepted)
        ->and($attempt->authenticated_user_id)->toBe($user->id)
        ->and($attempt->visitorObservation->path)->toBe('auth/verify')
        ->and($attempt->visitorObservation->authenticated_session_id)->toBe($authenticatedSession->id)
        ->and($authenticatedSession->user_id)->toBe($user->id)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);
});

test('verification without a stateful frontend session returns a descriptive error', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);

    $this->withHeaders([
        'Origin' => 'https://untrusted.example',
        'Referer' => 'https://untrusted.example/',
    ])->postJson('/auth/verify', [
        'otp_request_id' => $requestId,
        'code' => $code,
    ])->assertUnprocessable()->assertExactJson([
        'message' => 'Não foi possível iniciar uma sessão segura. Atualize a página e tente novamente.',
        'reason' => 'session_unavailable',
    ]);
});

test('invalid codes are generic and the final allowed failure locks the request', function () {
    config(['passwordless.otp.max_verification_attempts' => 3]);
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);
    $wrongCode = $code === '000000' ? '111111' : '000000';

    verifyLoginOtp($this, $requestId, $wrongCode)
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Código inválido ou expirado.']);
    verifyLoginOtp($this, $requestId, $wrongCode)->assertUnprocessable();
    verifyLoginOtp($this, $requestId, $wrongCode)->assertUnprocessable();
    verifyLoginOtp($this, $requestId, $code)
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Código inválido ou expirado.']);

    $otpRequest = OtpRequest::query()->findOrFail($requestId);

    expect($otpRequest->failed_attempts)->toBe(3)
        ->and($otpRequest->status)->toBe(OtpRequestStatus::Locked)
        ->and($otpRequest->attempts()->pluck('result')->all())->toBe([
            OtpAttemptResult::InvalidCode,
            OtpAttemptResult::InvalidCode,
            OtpAttemptResult::Locked,
            OtpAttemptResult::Locked,
        ])
        ->and(AuthenticatedSession::query()->count())->toBe(0);
    $this->assertGuest('web');
});

test('an expired otp is rejected and its attempt remains in history', function () {
    $otpRequest = OtpRequest::factory()->create([
        'expires_at' => now()->subSecond(),
    ]);

    verifyLoginOtp($this, $otpRequest->id, '123456')
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Código inválido ou expirado.']);

    expect($otpRequest->fresh()->status)->toBe(OtpRequestStatus::Expired)
        ->and($otpRequest->attempts()->sole()->result)->toBe(OtpAttemptResult::Expired)
        ->and(AuthenticatedSession::query()->count())->toBe(0);
});

test('the correct code cannot create a second session after it was used', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);

    verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    verifyLoginOtp($this, $requestId, $code)
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Código inválido ou expirado.']);

    expect(AuthenticatedSession::query()->count())->toBe(1)
        ->and(OtpAttempt::query()->pluck('result')->all())->toBe([
            OtpAttemptResult::Accepted,
            OtpAttemptResult::AlreadyUsed,
        ])
        ->and(OtpAttempt::query()->latest('id')->first()->authenticated_user_id)->toBe($user->id);
});

test('an older code is identified with either its old id or the current request id', function () {
    $user = User::factory()->create();
    [$oldRequestId, $oldCode] = issueLoginOtp($this, $user);
    [$currentRequestId, $currentCode] = issueLoginOtp($this, $user);

    verifyLoginOtp($this, $oldRequestId, $oldCode)
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Este código foi substituído por um código mais novo.',
            'reason' => 'otp_superseded',
        ]);
    verifyLoginOtp($this, $currentRequestId, $oldCode)
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'otp_superseded');

    $oldAttempt = OtpAttempt::query()->where('otp_request_id', $oldRequestId)->sole();
    $currentAttempt = OtpAttempt::query()->where('otp_request_id', $currentRequestId)->sole();

    expect($oldAttempt->result)->toBe(OtpAttemptResult::Superseded)
        ->and($oldAttempt->matched_otp_request_id)->toBeNull()
        ->and($currentAttempt->result)->toBe(OtpAttemptResult::Superseded)
        ->and($currentAttempt->matched_otp_request_id)->toBe($oldRequestId)
        ->and($currentAttempt->authenticated_user_id)->toBe($user->id)
        ->and(OtpRequest::query()->findOrFail($currentRequestId)->failed_attempts)->toBe(0);

    verifyLoginOtp($this, $currentRequestId, $currentCode)->assertNoContent();
});

test('verification rate limiting is audited without consuming a proof failure', function () {
    config(['passwordless.rate_limits.verify_per_ip.max_attempts' => 1]);
    $otpRequest = OtpRequest::factory()->create();

    verifyLoginOtp($this, $otpRequest->id, '000000', '192.0.2.10')->assertUnprocessable();
    verifyLoginOtp($this, $otpRequest->id, '000000', '192.0.2.10')
        ->assertTooManyRequests()
        ->assertExactJson(['message' => 'Muitas tentativas. Tente novamente mais tarde.']);

    expect($otpRequest->fresh()->failed_attempts)->toBe(1)
        ->and($otpRequest->attempts()->pluck('result')->all())->toBe([
            OtpAttemptResult::InvalidCode,
            OtpAttemptResult::RateLimited,
        ]);
});

test('an unknown request id fails generically without creating an audit row with no parent', function () {
    verifyLoginOtp($this, (string) Str::uuid(), '123456')
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Código inválido ou expirado.']);

    expect(OtpAttempt::query()->count())->toBe(0)
        ->and(AuthenticatedSession::query()->count())->toBe(0);
});

test('competing confirmations are serialized so only the first creates a session', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);

    verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    verifyLoginOtp($this, $requestId, $code)->assertUnprocessable();

    expect(AuthenticatedSession::query()->where('user_id', $user->id)->count())->toBe(1)
        ->and(OtpAttempt::query()->pluck('result')->all())->toBe([
            OtpAttemptResult::Accepted,
            OtpAttemptResult::AlreadyUsed,
        ]);
});

test('parallel mysql confirmations create exactly one session', function () {
    if (DB::getDriverName() !== 'mysql') {
        $this->markTestSkipped('A prova concorrente exige row locks do MySQL.');
    }

    $user = User::factory()->create();
    $otpRequest = OtpRequest::factory()->for($user)->create([
        'code_hash' => Hash::make('123456'),
    ]);
    $otpRequestId = $otpRequest->id;
    $observationIds = VisitorObservation::factory()->count(2)->create()->pluck('id')->all();

    DB::commit();

    try {
        $tasks = collect($observationIds)->map(
            fn (int $observationId): Closure => parallelOtpVerificationTask($otpRequestId, $observationId),
        )->all();

        $results = Concurrency::driver('process')->run($tasks, timeout: 30);
        sort($results);

        expect($results)->toBe(['accepted', 'already_used'])
            ->and(AuthenticatedSession::query()->where('user_id', $user->id)->count())->toBe(1)
            ->and(OtpAttempt::query()->where('otp_request_id', $otpRequestId)->count())->toBe(2);
    } finally {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach ([
            'otp_attempts',
            'otp_requests',
            'authenticated_sessions',
            'sessions',
            'personal_access_tokens',
            'visitor_observations',
            'visits',
            'ip_geolocations',
            'ip_addresses',
            'visitors',
            'users',
            'cache',
            'cache_locks',
        ] as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        DB::beginTransaction();
    }
})->group('mysql-concurrency');

test('logout ends only the current durable session and invalidates its web session', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);
    verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    $authenticatedSession = AuthenticatedSession::query()->sole();

    $this->withHeaders(statefulHeaders())->postJson('/auth/logout')->assertNoContent();

    $this->assertGuest('web');
    $this->withHeaders(statefulHeaders())
        ->getJson('/auth/session')
        ->assertUnauthorized();
    $this->withHeaders(statefulHeaders())
        ->getJson('/_test/passwordless-protected')
        ->assertUnauthorized();

    expect($authenticatedSession->fresh()->ended_at)->not->toBeNull()
        ->and($authenticatedSession->fresh()->end_reason)->toBe('logout')
        ->and(VisitorObservation::query()->where('path', 'auth/logout')->sole()->authenticated_session_id)
        ->toBe($authenticatedSession->id);
});

test('logout all ends every durable session and removes every web session for the user', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);
    verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    AuthenticatedSession::factory()->for($user)->create();
    DB::table('sessions')->insert([
        'id' => Str::random(40),
        'user_id' => $user->id,
        'ip_address' => '192.0.2.20',
        'user_agent' => 'test',
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);

    $this->withHeaders(statefulHeaders())->postJson('/auth/logout-all')->assertNoContent();

    expect(AuthenticatedSession::query()->where('user_id', $user->id)->whereNull('ended_at')->count())->toBe(0)
        ->and(AuthenticatedSession::query()->where('user_id', $user->id)->pluck('end_reason')->unique()->all())
        ->toBe(['logout_all'])
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
    $this->assertGuest('web');
    $this->withHeaders(statefulHeaders())
        ->getJson('/_test/passwordless-protected')
        ->assertUnauthorized();
});

test('web logout endpoints do not revoke a personal access token', function () {
    $user = User::factory()->create();
    $plainToken = $user->createToken('external-client')->plainTextToken;

    $this->withToken($plainToken)
        ->postJson('/auth/logout')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'Não autenticado.']);
    $this->withToken($plainToken)
        ->postJson('/auth/logout-all')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'Não autenticado.']);

    expect($user->tokens()->count())->toBe(1);
});

test('a user that becomes inactive loses every web session on the next authenticated request', function () {
    $user = User::factory()->create();
    [$requestId, $code] = issueLoginOtp($this, $user);
    verifyLoginOtp($this, $requestId, $code)->assertNoContent();
    $currentSession = AuthenticatedSession::query()->sole();
    $anotherSession = AuthenticatedSession::factory()->for($user)->create();
    DB::table('sessions')->insert([
        'id' => Str::random(40),
        'user_id' => $user->id,
        'ip_address' => '192.0.2.30',
        'user_agent' => 'test',
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);
    $user->update(['status' => User::STATUS_INACTIVE]);

    $this->withHeaders(statefulHeaders())
        ->getJson('/_test/passwordless-protected')
        ->assertForbidden()
        ->assertExactJson([
            'message' => 'Este membro não está ativo.',
            'reason' => 'user_not_active',
        ]);

    $this->assertGuest('web');
    expect($currentSession->fresh()->end_reason)->toBe('user_not_active')
        ->and($anotherSession->fresh()->end_reason)->toBe('user_not_active')
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(VisitorObservation::query()
            ->where('path', '_test/passwordless-protected')
            ->latest('id')
            ->firstOrFail()
            ->authenticated_session_id)->toBe($currentSession->id);
});

test('a personal access token is denied while its user is inactive', function () {
    $user = User::factory()->inactive()->create();
    $plainToken = $user->createToken('external-client')->plainTextToken;
    $token = $user->tokens()->sole();

    $this->withToken($plainToken)
        ->getJson('/_test/passwordless-protected')
        ->assertForbidden()
        ->assertExactJson([
            'message' => 'Este membro não está ativo.',
            'reason' => 'user_not_active',
        ]);

    expect($token->fresh())->not->toBeNull()
        ->and(VisitorObservation::query()->sole()->personal_access_token_id)->toBe($token->id);
});

test('stale durable sessions expire using the same sliding session lifetime', function () {
    $this->freezeTime();
    $configuredLifetimeMinutes = 37;
    config()->set('session.lifetime', $configuredLifetimeMinutes);

    $stale = AuthenticatedSession::factory()->create([
        'last_seen_at' => now()->subMinutes($configuredLifetimeMinutes)->subSecond(),
    ]);
    $active = AuthenticatedSession::factory()->create([
        'last_seen_at' => now(),
    ]);

    $this->getJson('/ping')->assertOk();

    expect($stale->fresh()->ended_at)->not->toBeNull()
        ->and($stale->fresh()->end_reason)->toBe('expired')
        ->and($active->fresh()->ended_at)->toBeNull();
});
