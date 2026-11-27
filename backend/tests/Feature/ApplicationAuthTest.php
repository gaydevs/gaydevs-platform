<?php

use App\Enums\ApplicantStatus;
use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Exceptions\RateLimitExceededException;
use App\Mail\ApplicationOtpMail;
use App\Models\Applicant;
use App\Models\AuthenticatedSession;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\ApplicantSessions;
use App\Services\ApplicationRateLimiter;
use App\Services\EmailRateLimiter;
use App\Services\EmailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'applications.enabled' => true,
        'applications.admin_email' => 'admin@example.test',
        'applications.whatsapp' => '5511999999999',
        'applications.turnstile' => ['sitekey' => 'test', 'secret' => 'test', 'hostname' => 'localhost', 'action' => 'application_otp'],
        'session.driver' => 'database',
    ]);
    app('session')->forgetDrivers();
    Mail::fake();
    Http::preventStrayRequests();
    Http::fake(['https://challenges.cloudflare.com/turnstile/v0/siteverify' => Http::response([
        'success' => true, 'hostname' => 'localhost', 'action' => 'application_otp',
    ])]);
    $this->withCredentials()->withHeaders(['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/gaydevs/platform/']);
});

function requestApplicationCode($test, string $email): array
{
    $response = $test->postJson('/applications/otp', ['email' => $email, 'turnstile_token' => 'test-token'])->assertAccepted();

    return [$response->json('otp_request_id'), Mail::sent(ApplicationOtpMail::class)->last()->code];
}

function verifyApplicationCode($test, array $challenge)
{
    return $test->postJson('/applications/verify', ['otp_request_id' => $challenge[0], 'code' => $challenge[1]]);
}

test('disabled or misconfigured registration fails closed and never sends mail', function () {
    config(['applications.enabled' => false]);
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertServiceUnavailable();
    config(['applications.enabled' => true, 'applications.whatsapp' => null]);
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertServiceUnavailable();
    expect(Applicant::count())->toBe(0);
    Mail::assertNothingSent();
    Http::assertNothingSent();
});

test('turnstile rejects invalid action hostname and failures before creating records', function () {
    config(['applications.turnstile.hostname' => 'wrong.test']);
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertUnprocessable();
    expect(Applicant::count())->toBe(0)->and(OtpRequest::count())->toBe(0);
    Mail::assertNothingSent();
});

test('registration is stateful and member authentication is never granted', function () {
    $this->getJson('/applications/session')->assertUnauthorized();
    $challenge = requestApplicationCode($this, ' Candidate@Example.test ');
    $otp = OtpRequest::findOrFail($challenge[0]);
    expect($otp->purpose)->toBe(OtpPurpose::Registration)
        ->and($otp->applicant->status)->toBe(ApplicantStatus::Unverified)
        ->and($otp->email)->toBe('candidate@example.test');

    $response = verifyApplicationCode($this, $challenge)->assertOk()->assertExactJson(['status' => 'draft']);
    $cookie = $response->getCookie(ApplicantSessions::COOKIE);
    expect($cookie)->not->toBeNull()->and($cookie->isSecure())->toBeTrue()->and($cookie->isHttpOnly())->toBeTrue();
    expect($otp->refresh()->status)->toBe(OtpRequestStatus::Used)
        ->and($otp->attempts()->sole()->authenticated_user_id)->toBeNull()
        ->and(AuthenticatedSession::count())->toBe(0);
    $this->withCookie(ApplicantSessions::COOKIE, $cookie->getValue())
        ->getJson('/applications/session')->assertOk()->assertJsonPath('whatsapp_url', 'https://wa.me/5511999999999');
    $this->getJson('/auth/session')->assertUnauthorized();
    verifyApplicationCode($this, $challenge)->assertUnprocessable();
});

test('active inactive and unknown email challenges have the same public shape', function () {
    User::factory()->create(['email' => 'active@example.test']);
    User::factory()->inactive()->create(['email' => 'inactive@example.test']);
    foreach (['active@example.test', 'inactive@example.test', 'unknown@example.test'] as $email) {
        $challenge = requestApplicationCode($this, $email);
        $otp = OtpRequest::findOrFail($challenge[0]);
        if ($email !== 'unknown@example.test') {
            expect($otp->applicant_id)->toBeNull();
            verifyApplicationCode($this, $challenge)->assertOk()->assertExactJson(['status' => 'member', 'next' => 'login']);
        }
    }
    expect(Applicant::count())->toBe(1)->and(AuthenticatedSession::count())->toBe(0);
});

test('registration verification refuses login OTP and locks after five wrong codes', function () {
    $login = OtpRequest::factory()->create();
    verifyApplicationCode($this, [$login->id, '123456'])->assertUnprocessable();
    expect($login->refresh()->status)->toBe(OtpRequestStatus::Pending);
    $challenge = requestApplicationCode($this, 'a@example.test');
    $wrong = $challenge[1] === '000000' ? '111111' : '000000';
    for ($i = 0; $i < 5; $i++) {
        verifyApplicationCode($this, [$challenge[0], $wrong])->assertUnprocessable();
    }
    verifyApplicationCode($this, $challenge)->assertUnprocessable();
    expect(OtpRequest::findOrFail($challenge[0])->status)->toBe(OtpRequestStatus::Locked);
});

test('resend supersedes only its email and purpose and consumes fresh turnstile', function () {
    $first = requestApplicationCode($this, 'a@example.test');
    $other = requestApplicationCode($this, 'b@example.test');
    $this->travel(61)->seconds();
    $next = requestApplicationCode($this, 'a@example.test');
    expect(OtpRequest::findOrFail($first[0])->status)->toBe(OtpRequestStatus::Superseded)
        ->and(OtpRequest::findOrFail($other[0])->status)->toBe(OtpRequestStatus::Pending);
    verifyApplicationCode($this, $first)->assertUnprocessable();
    verifyApplicationCode($this, $next)->assertOk();
    Http::assertSentCount(3);
});

test('rate limiter counts invalid inputs and turnstile requests before validation', function () {
    config(['applications.limits.ip_hour' => 2]);
    $this->postJson('/applications/otp', [])->assertUnprocessable();
    $this->postJson('/applications/otp', [])->assertUnprocessable();
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertTooManyRequests();
    Mail::assertNothingSent();
});

test('email cooldown and shared mail budget prevent extra sends', function () {
    config(['applications.limits.mail_day' => 1]);
    requestApplicationCode($this, 'a@example.test');
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertTooManyRequests();
    $this->postJson('/applications/otp', ['email' => 'b@example.test', 'turnstile_token' => 'token'])->assertTooManyRequests();
    Mail::assertSentCount(1);
    expect(Applicant::count())->toBe(1);
});

test('candidate sessions rotate and expire independently of member sessions', function () {
    $applicant = Applicant::factory()->draft()->create();
    $sessions = app(ApplicantSessions::class);
    $old = $sessions->issue($applicant);
    $new = $sessions->issue($applicant);
    $this->withCookie(ApplicantSessions::COOKIE, $old)->getJson('/applications/session')->assertUnauthorized();
    $this->withCookie(ApplicantSessions::COOKIE, $new)->getJson('/applications/session')->assertOk();
    $this->travel(29)->days();
    $this->getJson('/applications/session')->assertOk();
    $this->travel(29)->days();
    $this->getJson('/applications/session')->assertOk();
    $this->travel(29)->days();
    $this->getJson('/applications/session')->assertOk();
    $this->travel(4)->days();
    $this->getJson('/applications/session')->assertUnauthorized();
    expect(DB::table('applicant_sessions')->count())->toBe(0);
});

test('candidate session expires by inactivity and logout revokes its token', function () {
    $applicant = Applicant::factory()->draft()->create();
    $token = app(ApplicantSessions::class)->issue($applicant);
    $this->withCookie(ApplicantSessions::COOKIE, $token)->getJson('/applications/session')->assertOk();
    $this->postJson('/applications/logout')->assertNoContent();
    $this->getJson('/applications/session')->assertUnauthorized();
    $new = app(ApplicantSessions::class)->issue($applicant);
    $this->travel(31)->days();
    $this->withCookie(ApplicantSessions::COOKIE, $new)->getJson('/applications/session')->assertUnauthorized();
});

test('candidate session ignores caller supplied id and redacts private visitor headers', function () {
    $applicant = Applicant::factory()->draft()->create();
    $other = Applicant::factory()->draft()->create(['revision' => 99]);
    $token = app(ApplicantSessions::class)->issue($applicant);
    $response = $this->withCookie(ApplicantSessions::COOKIE, $token)->withHeaders([
        'Referer' => 'http://127.0.0.1:5173/?email=private@example.test',
        'User-Agent' => 'private@example.test',
    ])->getJson('/applications/session?applicant_id='.$other->id)->assertOk()->assertJsonPath('revision', $applicant->revision);
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    $observation = VisitorObservation::query()->latest('id')->first();
    expect($observation->referer)->toBeNull()->and($observation->user_agent)->toBeNull()->and($observation->path)->toBe('applications');
});

test('stateless requests cannot issue OTP or retrieve candidate session', function () {
    $this->withHeaders(['Origin' => 'https://untrusted.example', 'Referer' => 'https://untrusted.example/']);
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertUnauthorized();
    $this->getJson('/applications/session')->assertUnauthorized();
    Mail::assertNothingSent();
});

test('member login revokes a candidate cookie without granting candidate access', function () {
    $candidate = Applicant::factory()->draft()->create();
    $token = app(ApplicantSessions::class)->issue($candidate);
    $member = User::factory()->create();
    $login = OtpRequest::factory()->for($member)->create();
    $this->withCookie(ApplicantSessions::COOKIE, $token)->postJson('/auth/verify', ['otp_request_id' => $login->id, 'code' => '123456'])->assertNoContent();
    expect(DB::table('applicant_sessions')->where('applicant_id', $candidate->id)->exists())->toBeFalse();
    $this->assertAuthenticatedAs($member);
    $this->getJson('/applications/session')->assertUnauthorized();
});

test('expired registration code leaves application unverified', function () {
    $challenge = requestApplicationCode($this, 'a@example.test');
    $this->travel(11)->minutes();
    verifyApplicationCode($this, $challenge)->assertUnprocessable();
    expect(OtpRequest::findOrFail($challenge[0])->status)->toBe(OtpRequestStatus::Expired)
        ->and(Applicant::query()->sole()->status)->toBe(ApplicantStatus::Unverified)
        ->and(DB::table('applicant_sessions')->count())->toBe(0);
});

test('rejected application is renewed only after valid registration code', function () {
    $old = Applicant::factory()->rejected()->create();
    $challenge = requestApplicationCode($this, $old->email);
    expect(Applicant::count())->toBe(1);
    verifyApplicationCode($this, $challenge)->assertOk()->assertExactJson(['status' => 'draft']);
    expect(Applicant::count())->toBe(2)
        ->and($old->refresh()->status)->toBe(ApplicantStatus::Rejected)
        ->and($old->events()->where('event_type', 'reapplication')->count())->toBe(1);
});

test('terminal candidate session exposes status only', function () {
    $applicant = Applicant::factory()->draft()->create();
    $token = app(ApplicantSessions::class)->issue($applicant);
    $applicant->forceFill(['status' => ApplicantStatus::Approved])->save();
    $this->withCookie(ApplicantSessions::COOKIE, $token)->getJson('/applications/session')->assertOk()->assertExactJson(['status' => 'approved']);
    $this->getJson('/auth/session')->assertUnauthorized();
});

test('failed application email consumes both budgets and leaves capacity for member login', function () {
    config(['rate_limits.global.email.max_attempts' => 4]);
    $sender = Mockery::mock(EmailSender::class);
    $sender->shouldReceive('sendReserved')->once()->andThrow(new RuntimeException('simulated transport failure'));
    app()->instance(EmailSender::class, $sender);
    $this->postJson('/applications/otp', ['email' => 'a@example.test', 'turnstile_token' => 'token'])->assertServiceUnavailable();
    expect(RateLimiter::attempts(EmailRateLimiter::HOURLY_KEY))->toBe(1);
    app(ApplicationRateLimiter::class)->mail();
    expect(fn () => app(ApplicationRateLimiter::class)->mail())->toThrow(RateLimitExceededException::class);
    app(EmailRateLimiter::class)->reserve();
    expect(RateLimiter::attempts(EmailRateLimiter::HOURLY_KEY))->toBe(3);
});

test('turnstile rejects action mismatch and limits repeated invalid challenges', function () {
    config(['applications.turnstile.action' => 'wrong_action', 'applications.limits.ip_hour' => 2]);
    $payload = ['email' => 'a@example.test', 'turnstile_token' => 'token'];
    $this->postJson('/applications/otp', $payload)->assertUnprocessable();
    $this->postJson('/applications/otp', $payload)->assertUnprocessable();
    $this->postJson('/applications/otp', $payload)->assertTooManyRequests();
    Http::assertSentCount(2);
    Mail::assertNothingSent();
    expect(Applicant::count())->toBe(0);
});
