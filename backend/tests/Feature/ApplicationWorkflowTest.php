<?php

use App\Enums\ApplicantStatus;
use App\Enums\MemberType;
use App\Mail\ApplicationSubmittedMail;
use App\Models\Applicant;
use App\Models\User;
use App\Services\ApplicantSessions;
use App\Services\ApplicationNotifications;
use App\Services\ApplicationProfileProbe;
use App\Services\ApplicationRateLimiter;
use App\Services\ApplicationTerms;
use App\Services\EmailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'applications.enabled' => true,
        'applications.admin_email' => 'admin@example.test',
        'applications.whatsapp' => '5511999999999',
        'applications.platform_url' => 'https://example.test/platform',
        'applications.turnstile' => ['sitekey' => 'test', 'secret' => 'test', 'hostname' => 'localhost', 'action' => 'application_otp'],
    ]);
    $this->withCredentials()->withHeaders(['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/gaydevs/platform/']);
    Mail::fake();
    $probe = Mockery::mock(ApplicationProfileProbe::class);
    $probe->shouldReceive('resolve')->andReturn(['8.8.8.8']);
    $probe->shouldReceive('lookup')->andReturn(['status' => 403, 'login' => null]);
    app()->instance(ApplicationProfileProbe::class, $probe);
});

function workflowCandidate($test): Applicant
{
    $a = Applicant::factory()->draft()->create();
    app(ApplicationTerms::class)->record($a, ['personal_data']);
    $test->withCookie(ApplicantSessions::COOKIE, app(ApplicantSessions::class)->issue($a));

    return $a;
}

function workflowReady($test): Applicant
{
    $a = workflowCandidate($test);
    $test->patchJson('/applications/steps/identification', ['revision' => $a->revision, 'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '(11) 99999-9999'])->assertOk();
    $test->patchJson('/applications/steps/profiles', [
        'revision' => $a->refresh()->revision, 'linkedin' => 'test-candidate', 'github' => null, 'github_skip_confirmed' => true,
        'instagram' => '@test.candidate', 'consents' => ['external_profiles' => ApplicationTerms::VERSION],
    ])->assertOk();
    $test->patchJson('/applications/steps/origin', ['revision' => $a->refresh()->revision, 'referral_source' => 'Um evento específico', 'collaboration_interest' => false])->assertOk();
    $acceptances = array_fill_keys(array_keys(app(ApplicationTerms::class)->texts()), ApplicationTerms::VERSION);
    $test->patchJson('/applications/steps/terms', ['revision' => $a->refresh()->revision, 'consents' => $acceptances])->assertOk();

    return $a->refresh();
}

function workflowPending(): Applicant
{
    return Applicant::factory()->draft()->create([
        'first_name' => 'Test', 'last_name' => 'Candidate', 'status' => ApplicantStatus::Pending, 'submitted_at' => now(),
    ]);
}

test('public terms contain no private contact and are versioned', function () {
    $this->getJson('/applications/terms')->assertOk()->assertJsonPath('version', ApplicationTerms::VERSION)
        ->assertJsonCount(7, 'consents')->assertJsonMissing(['whatsapp_url' => 'https://wa.me/5511999999999']);
});

test('wizard saves canonical fields and submits exactly one notification intent', function () {
    $a = workflowReady($this);
    expect($a->whatsapp)->toBe('+5511999999999')
        ->and($a->linkedin)->toBe('https://linkedin.com/in/test-candidate')
        ->and($a->instagram)->toBe('https://instagram.com/test.candidate')
        ->and($a->consents()->count())->toBe(7)
        ->and($a->events()->where('event_type', 'step_completed')->count())->toBe(4);
    $this->getJson('/applications/session')->assertOk()->assertJsonPath('fields.referral_source', 'Um evento específico')
        ->assertJsonPath('fields.collaboration_interest', false)->assertJsonPath('current_step', 'ready');
    $revision = $a->revision;
    $this->postJson('/applications/submit', ['revision' => $revision])->assertOk()->assertJsonPath('status', 'pending');
    $this->postJson('/applications/submit', ['revision' => $revision])->assertOk()->assertJsonPath('status', 'pending');
    expect(DB::table('application_notifications')->count())->toBe(1)
        ->and($a->refresh()->status)->toBe(ApplicantStatus::Pending)
        ->and($a->events()->where('event_type', 'submitted')->count())->toBe(1);
    $this->patchJson('/applications/steps/origin', ['revision' => $a->revision, 'referral_source' => 'Other', 'collaboration_interest' => true])->assertConflict();
    Mail::assertNothingSent();
});

test('candidate cannot skip steps or submit incomplete data and stale revision is refused', function () {
    $a = workflowCandidate($this);
    $this->patchJson('/applications/steps/origin', ['revision' => $a->revision])->assertConflict();
    $this->postJson('/applications/submit', ['revision' => $a->revision])->assertUnprocessable();
    $this->patchJson('/applications/steps/identification', ['revision' => $a->revision, 'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '+12025550123', 'status' => 'approved', 'email' => 'attacker@example.test'])->assertOk();
    $this->patchJson('/applications/steps/identification', ['revision' => $a->revision, 'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '+12025550123'])->assertConflict();
    expect($a->refresh()->status)->toBe(ApplicantStatus::Draft)
        ->and($a->email)->not->toBe('attacker@example.test')
        ->and(DB::table('application_notifications')->count())->toBe(0);
});

test('profile lookup requires explicit current consent and github absence confirmation', function () {
    $a = workflowCandidate($this);
    $a->forceFill(['current_step' => 'profiles'])->save();
    $probe = Mockery::mock(ApplicationProfileProbe::class);
    $probe->shouldNotReceive('resolve');
    app()->instance(ApplicationProfileProbe::class, $probe);
    $this->patchJson('/applications/steps/profiles', ['revision' => $a->revision, 'linkedin' => 'test', 'github_skip_confirmed' => true])->assertUnprocessable();
    $this->patchJson('/applications/steps/profiles', ['revision' => $a->revision, 'linkedin' => 'test', 'consents' => ['external_profiles' => ApplicationTerms::VERSION]])->assertUnprocessable();
    expect($a->refresh()->linkedin)->toBeNull();
});

test('submission rechecks current consents and rolls back if notification insert fails', function () {
    $a = workflowReady($this);
    $a->consents()->where('consent_key', 'personal_data')->delete();
    $this->postJson('/applications/submit', ['revision' => $a->revision])->assertUnprocessable();
    expect($a->refresh()->status)->toBe(ApplicantStatus::Draft)->and(DB::table('application_notifications')->count())->toBe(0);
    $this->patchJson('/applications/steps/terms', ['revision' => $a->revision, 'consents' => array_fill_keys(array_keys(app(ApplicationTerms::class)->texts()), ApplicationTerms::VERSION)])->assertOk();
    $notifications = Mockery::mock(ApplicationNotifications::class);
    $notifications->shouldReceive('enqueue')->once()->andThrow(new RuntimeException('simulated failure'));
    app()->instance(ApplicationNotifications::class, $notifications);
    $this->postJson('/applications/submit', ['revision' => $a->refresh()->revision])->assertServerError();
    expect($a->refresh()->status)->toBe(ApplicantStatus::Draft)->and($a->events()->where('event_type', 'submitted')->count())->toBe(0);
});

test('admin routes reject visitors members and candidates and sort by submission', function () {
    $a = workflowPending();
    $b = workflowPending();
    $b->forceFill(['submitted_at' => now()->subDay()])->save();
    $this->getJson('/admin/applications')->assertUnauthorized();
    workflowCandidate($this);
    $this->getJson('/admin/applications')->assertUnauthorized();
    $this->actingAs(User::factory()->create())->getJson('/admin/applications')->assertForbidden();
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $this->actingAs($admin)->getJson('/admin/applications')->assertOk()->assertJsonPath('data.0.id', $b->id)->assertJsonPath('data.1.id', $a->id);
    $this->getJson('/admin/applications/'.$a->id)->assertOk()->assertJsonPath('fields.email', $a->email);
    $this->patchJson('/admin/applications/'.$a->id, ['first_name' => 'Other'])->assertStatus(405);
});

test('admin notes use revision and approval and rejection remain atomic', function () {
    $a = workflowPending();
    $b = workflowPending();
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $this->actingAs($admin)->patchJson('/admin/applications/'.$a->id.'/notes', ['revision' => $a->revision, 'admin_notes' => 'Internal note', 'first_name' => 'Other'])->assertOk();
    expect($a->refresh()->first_name)->toBe('Test')->and($a->admin_notes)->toBe('Internal note');
    $this->patchJson('/admin/applications/'.$a->id.'/notes', ['revision' => 0, 'admin_notes' => 'Stale'])->assertConflict();
    $this->postJson('/admin/applications/'.$a->id.'/approve')->assertOk()->assertJsonPath('status', 'approved');
    $this->postJson('/admin/applications/'.$a->id.'/approve')->assertOk();
    $this->postJson('/admin/applications/'.$a->id.'/reject')->assertConflict();
    expect(User::where('applicant_id', $a->id)->count())->toBe(1)
        ->and($a->refresh()->reviewed_by)->toBe($admin->id);
    $this->postJson('/admin/applications/'.$b->id.'/reject')->assertOk()->assertJsonPath('status', 'rejected');
    expect($b->refresh()->member)->toBeNull();
});

test('outbox sends a minimal authenticated link only once and reserves shared budget', function () {
    $a = workflowReady($this);
    $this->postJson('/applications/submit', ['revision' => $a->revision])->assertOk();
    $worker = app(ApplicationNotifications::class);
    expect($worker->process())->toBe(1)->and($worker->process())->toBe(0);
    Mail::assertSent(ApplicationSubmittedMail::class, fn ($mail) => $mail->reviewUrl === 'https://example.test/platform/admin/applications/'.$a->id && $mail->hasTo('admin@example.test'));
    expect(DB::table('application_notifications')->where('applicant_id', $a->id)->value('status'))->toBe('sent');
});

test('outbox defers pre-send failure and never repeats ambiguous delivery', function () {
    $a = workflowPending();
    $worker = app(ApplicationNotifications::class);
    $worker->enqueue($a);
    config(['applications.limits.mail_day' => 0]);
    expect($worker->process())->toBe(0);
    expect(DB::table('application_notifications')->where('applicant_id', $a->id)->value('status'))->toBe('pending');
    config(['applications.limits.mail_day' => 100]);
    $this->travel(61)->minutes();
    $sender = Mockery::mock(EmailSender::class);
    $sender->shouldReceive('sendReserved')->once()->andThrow(new RuntimeException('simulated ambiguous SMTP result'));
    $worker = new ApplicationNotifications(app(ApplicationRateLimiter::class), $sender);
    expect($worker->process())->toBe(0)->and($worker->process())->toBe(0);
    expect(DB::table('application_notifications')->where('applicant_id', $a->id)->value('status'))->toBe('unknown')
        ->and($a->refresh()->status)->toBe(ApplicantStatus::Pending);
});

test('draft without current privacy acceptance cannot write personal data', function () {
    $a = Applicant::factory()->draft()->create();
    $this->withCookie(ApplicantSessions::COOKIE, app(ApplicantSessions::class)->issue($a));
    $this->patchJson('/applications/steps/identification', ['revision' => $a->revision, 'first_name' => 'Test', 'last_name' => 'Candidate', 'whatsapp' => '+12025550123'])->assertUnprocessable();
    expect($a->refresh()->first_name)->toBeNull();
});
