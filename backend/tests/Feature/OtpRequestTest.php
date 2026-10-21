<?php

use App\Enums\OtpRequestStatus;
use App\Http\Middleware\TrackVisitor;
use App\Mail\LoginOtpMail;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    Mail::fake();
});

test('requesting an otp sends a six digit code without authenticating', function () {
    $user = User::factory()->create(['email' => 'user@example.com']);

    $response = $this->postJson('/auth/otp', ['user_id' => $user->id])
        ->assertAccepted()
        ->assertJsonStructure(['otp_request_id', 'expires_at']);

    $request = OtpRequest::query()->findOrFail($response->json('otp_request_id'));
    $requestId = $response->headers->get('X-Request-ID');

    expect($request->status)->toBe(OtpRequestStatus::Pending)
        ->and($request->expires_at->diffInSeconds(now(), absolute: true))->toBeBetween(590, 610)
        ->and($request->visitorObservation)->toBeInstanceOf(VisitorObservation::class)
        ->and($requestId)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i')
        ->and($request->visitorObservation->request_id)->toBe($requestId)
        ->and(auth()->check())->toBeFalse();

    Mail::assertSent(LoginOtpMail::class, function (LoginOtpMail $mail) use ($user, $request): bool {
        $mail->assertTo($user->email);
        $rendered = $mail->render();

        return preg_match('/\b\d{6}\b/', $mail->envelope()->subject, $matches) === 1
            && Hash::check($matches[0], $request->code_hash)
            && str_contains($rendered, "\n{$matches[0]}\n");
    });
});

test('a newer otp supersedes the previous request and uses a different code', function () {
    $user = User::factory()->create();

    $firstResponse = $this->postJson('/auth/otp', ['user_id' => $user->id])->assertAccepted();
    $secondResponse = $this->postJson('/auth/otp', ['user_id' => $user->id])->assertAccepted();

    $first = OtpRequest::query()->findOrFail($firstResponse->json('otp_request_id'));
    $second = OtpRequest::query()->findOrFail($secondResponse->json('otp_request_id'));
    $codes = [];
    Mail::assertSent(LoginOtpMail::class, 2);
    Mail::assertSent(LoginOtpMail::class, function (LoginOtpMail $mail) use (&$codes): bool {
        preg_match('/\b\d{6}\b/', $mail->envelope()->subject, $matches);
        $codes[] = $matches[0];

        return true;
    });

    expect($first->status)->toBe(OtpRequestStatus::Superseded)
        ->and($first->superseded_by_id)->toBe($second->id)
        ->and($first->superseded_at)->not->toBeNull()
        ->and($second->status)->toBe(OtpRequestStatus::Pending)
        ->and(OtpRequest::query()->where('user_id', $user->id)->where('status', 'pending')->count())->toBe(1)
        ->and(array_unique($codes))->toHaveCount(2);
});

test('a missing user returns a descriptive error', function () {
    $this->postJson('/auth/otp', ['user_id' => (string) Str::uuid()])
        ->assertNotFound()
        ->assertExactJson([
            'message' => 'Membro não encontrado.',
            'reason' => 'user_not_found',
        ]);

    expect(OtpRequest::query()->count())->toBe(0);
    Mail::assertNothingSent();
});

test('a user that is not active returns a descriptive error', function () {
    $inactive = User::factory()->inactive()->create();

    $this->postJson('/auth/otp', ['user_id' => $inactive->id])
        ->assertForbidden()
        ->assertExactJson([
            'message' => 'Este membro não está ativo.',
            'reason' => 'user_not_active',
        ]);

    expect(OtpRequest::query()->count())->toBe(0);
    Mail::assertNothingSent();
});

test('otp request user rate limit follows the user across different ips', function () {
    config([
        'passwordless.rate_limits.request_per_user.max_attempts' => 2,
        'passwordless.rate_limits.request_per_ip.max_attempts' => 20,
    ]);
    $user = User::factory()->create();

    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.1'])
        ->postJson('/auth/otp', ['user_id' => $user->id])
        ->assertAccepted();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])
        ->postJson('/auth/otp', ['user_id' => $user->id])
        ->assertAccepted();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.3'])
        ->postJson('/auth/otp', ['user_id' => $user->id])
        ->assertTooManyRequests();

    expect(OtpRequest::query()->count())->toBe(2);
});

test('otp request ip rate limit applies across users and does not affect another ip', function () {
    config([
        'passwordless.rate_limits.request_per_user.max_attempts' => 10,
        'passwordless.rate_limits.request_per_ip.max_attempts' => 2,
    ]);
    [$first, $second, $third] = User::factory()->count(3)->create();

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])
        ->postJson('/auth/otp', ['user_id' => $first->id])
        ->assertAccepted();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])
        ->postJson('/auth/otp', ['user_id' => $second->id])
        ->assertAccepted();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])
        ->postJson('/auth/otp', ['user_id' => $third->id])
        ->assertTooManyRequests();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.2'])
        ->postJson('/auth/otp', ['user_id' => $third->id])
        ->assertAccepted();

    expect(OtpRequest::query()->count())->toBe(3);
});

test('otp request rate limit expires after its configured window', function () {
    config([
        'passwordless.rate_limits.request_per_user.max_attempts' => 1,
        'passwordless.rate_limits.request_per_ip.max_attempts' => 20,
    ]);
    $this->freezeTime();
    $user = User::factory()->create();

    $this->postJson('/auth/otp', ['user_id' => $user->id])->assertAccepted();
    $this->postJson('/auth/otp', ['user_id' => $user->id])->assertTooManyRequests();

    $this->travel((int) config('passwordless.rate_limits.request_per_user.decay_seconds') + 1)->seconds();

    $this->postJson('/auth/otp', ['user_id' => $user->id])->assertAccepted();

    expect(OtpRequest::query()->count())->toBe(2);
});

test('otp requests without a detected ip share the unknown ip limit', function () {
    config([
        'passwordless.rate_limits.request_per_user.max_attempts' => 10,
        'passwordless.rate_limits.request_per_ip.max_attempts' => 1,
    ]);
    [$first, $second] = User::factory()->count(2)->create();

    $this->withServerVariables(['REMOTE_ADDR' => null])
        ->postJson('/auth/otp', ['user_id' => $first->id])
        ->assertAccepted();
    $this->withServerVariables(['REMOTE_ADDR' => null])
        ->postJson('/auth/otp', ['user_id' => $second->id])
        ->assertTooManyRequests();

    expect(OtpRequest::query()->count())->toBe(1);
});

test('missing visitor observation returns a generic internal error', function () {
    config(['app.debug' => false]);
    $user = User::factory()->create();

    $response = $this->withoutMiddleware(TrackVisitor::class)
        ->postJson('/auth/otp', ['user_id' => $user->id])
        ->assertInternalServerError()
        ->assertJsonStructure(['message', 'reference'])
        ->assertJsonPath('message', 'Erro interno do servidor.')
        ->assertDontSee('observação do visitante', false);

    expect($response->json('reference'))->toBe($response->headers->get('X-Request-ID'))
        ->and($response->json('reference'))->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i')
        ->and(OtpRequest::query()->count())->toBe(0);
    Mail::assertNothingSent();
});

test('otp generation failures return a reference and log full diagnostic identifiers', function () {
    config([
        'app.debug' => false,
        'passwordless.otp.max_generation_attempts' => 0,
    ]);
    $logPath = storage_path('logs/operational-test-'.Str::uuid().'.log');
    config([
        'logging.channels.operational' => [
            'driver' => 'single',
            'path' => $logPath,
            'level' => 'error',
            'replace_placeholders' => true,
        ],
    ]);
    Log::forgetChannel('operational');
    $user = User::factory()->create();

    try {
        $response = $this->postJson('/auth/otp', ['user_id' => $user->id])
            ->assertInternalServerError()
            ->assertJsonStructure(['message', 'reference'])
            ->assertJsonPath('message', 'Erro interno do servidor.')
            ->assertDontSee('Não foi possível gerar um OTP inédito.', false);

        $observation = VisitorObservation::query()->sole();
        $log = file_get_contents($logPath);

        expect($response->json('reference'))->toBe($response->headers->get('X-Request-ID'))
            ->and($response->json('reference'))->toBe($observation->request_id)
            ->and($log)->toContain('otp_generation_failed')
            ->and($log)->toContain($response->json('reference'))
            ->and($log)->toContain($user->id)
            ->and($log)->toContain('"visitor_observation_id":'.$observation->id)
            ->and(OtpRequest::query()->count())->toBe(0);
        Mail::assertNothingSent();
    } finally {
        Log::forgetChannel('operational');
        if (is_file($logPath)) {
            unlink($logPath);
        }
    }
});
