<?php

use App\Enums\ApplicantStatus;
use App\Models\Applicant;
use App\Services\ApplicantSessions;
use App\Services\ApplicationNotifications;
use App\Services\ApplicationTerms;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Monolog\Handler\TestHandler;

uses(RefreshDatabase::class);

class ApplicationCsrfEnforced extends PreventRequestForgery
{
    protected function runningUnitTests()
    {
        return false;
    }
}

beforeEach(function () {
    config([
        'applications.enabled' => true,
        'applications.admin_email' => 'admin@example.test',
        'applications.whatsapp' => '5511999999999',
        'applications.turnstile' => ['sitekey' => 'test', 'secret' => 'test', 'hostname' => 'localhost', 'action' => 'application_otp'],
        'sanctum.middleware.validate_csrf_token' => ApplicationCsrfEnforced::class,
    ]);
    $this->withCredentials()->withHeaders(['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/gaydevs/platform/']);
});

test('candidate write requires valid CSRF token when framework protection is active', function () {
    $candidate = Applicant::factory()->draft()->create();
    $this->withCookie(ApplicantSessions::COOKIE, app(ApplicantSessions::class)->issue($candidate));
    $payload = ['revision' => $candidate->revision, 'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '+12025550123'];
    $this->patchJson('/applications/steps/identification', $payload)->assertStatus(419);
    expect($candidate->refresh()->first_name)->toBeNull();

    $csrf = $this->get('/sanctum/csrf-cookie')->getCookie('XSRF-TOKEN', false);
    expect($csrf)->not->toBeNull();
    $this->withHeader('X-XSRF-TOKEN', $csrf->getValue())->patchJson('/applications/steps/identification', $payload)->assertOk();
    expect($candidate->refresh()->first_name)->toBe('Test');
});

test('private application failure is reported without exception payload or field values', function () {
    $candidate = Applicant::factory()->draft()->create(['current_step' => 'ready']);
    $candidate->forceFill([
        'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '+12025550123',
        'linkedin' => 'https://linkedin.com/in/test', 'github_skip_confirmed_at' => now(),
        'referral_source' => 'Test referral', 'collaboration_interest' => true,
    ])->save();
    $terms = app(ApplicationTerms::class);
    $terms->record($candidate, array_keys($terms->texts()));
    $this->withCookie(ApplicantSessions::COOKIE, app(ApplicantSessions::class)->issue($candidate));
    $csrf = $this->get('/sanctum/csrf-cookie')->getCookie('XSRF-TOKEN', false);
    $this->withHeader('X-XSRF-TOKEN', $csrf->getValue());

    $notifications = Mockery::mock(ApplicationNotifications::class);
    $notifications->shouldReceive('enqueue')->once()->andThrow(new RuntimeException('private-value@example.test'));
    app()->instance(ApplicationNotifications::class, $notifications);
    $handler = new TestHandler;
    $logger = Log::channel('operational')->getLogger();
    $logger->pushHandler($handler);
    try {
        $response = $this->postJson('/applications/submit', ['revision' => $candidate->revision])->assertServerError();
    } finally {
        $logger->popHandler();
    }
    $entries = array_map(fn ($record) => [$record->message, $record->context], $handler->getRecords());
    $entry = collect($entries)->first(fn ($entry) => $entry[0] === 'applications.unhandled_exception');
    expect($entry)->not->toBeNull()
        ->and(array_keys($entry[1]))->toBe(['request_id', 'exception_type'])
        ->and($entry[1]['exception_type'])->toBe(RuntimeException::class)
        ->and(json_encode($entries))->not->toContain('private-value@example.test');
    expect($response->getContent())->not->toContain('private-value@example.test')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($candidate->refresh()->status)->toBe(ApplicantStatus::Draft)
        ->and(DB::table('application_notifications')->count())->toBe(0);
});
