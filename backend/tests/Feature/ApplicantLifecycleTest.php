<?php

use App\Enums\ApplicantStatus;
use App\Enums\MemberType;
use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Models\Applicant;
use App\Models\AuthenticatedSession;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\ApplicantLifecycle;
use App\Services\OtpIssuer;
use App\Services\OtpVerifier;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

uses(RefreshDatabase::class);

function applicationProof(Applicant $applicant): OtpRequest
{
    return OtpRequest::factory()->forApplicant($applicant)->create([
        'status' => OtpRequestStatus::Used,
        'accepted_at' => now(),
    ]);
}

function pendingApplication(): Applicant
{
    return Applicant::factory()->draft()->create([
        'first_name' => 'Test',
        'last_name' => 'Candidate',
        'status' => ApplicantStatus::Pending,
        'submitted_at' => now(),
    ]);
}

test('otp purpose constrains identity and hides recipient snapshots', function () {
    $applicant = Applicant::factory()->create();
    $user = User::factory()->create();
    $registration = OtpRequest::factory()->forApplicant($applicant)->create();
    $login = OtpRequest::factory()->for($user)->create()->refresh();

    expect($registration->user_id)->toBeNull()
        ->and($registration->applicant->is($applicant))->toBeTrue()
        ->and($login->purpose)->toBe(OtpPurpose::Login)
        ->and($login->email)->toBe($user->email)
        ->and($login->toArray())->not->toHaveKey('email');

    expect(fn () => DB::table('otp_requests')->where('id', $registration->id)->update(['user_id' => $user->id]))
        ->toThrow(QueryException::class);
    expect(fn () => DB::table('otp_requests')->where('id', $registration->id)->update(['purpose' => 'login']))
        ->toThrow(QueryException::class);
    expect(fn () => DB::table('otp_requests')->where('id', $registration->id)->update(['applicant_id' => null]))
        ->toThrow(QueryException::class);
    expect(fn () => $applicant->delete())->toThrow(QueryException::class);
});

test('member proof of possession cannot authenticate or supersede member login', function () {
    $user = User::factory()->create();
    $observation = VisitorObservation::factory()->create();
    $registration = OtpRequest::factory()->for($user)->create(['purpose' => OtpPurpose::Registration]);
    $login = app(OtpIssuer::class)->issue($user, $observation);

    expect($registration->refresh()->status)->toBe(OtpRequestStatus::Pending);
    expect(fn () => DB::table('otp_requests')->where('id', $registration->id)->update(['purpose' => 'login']))
        ->toThrow(QueryException::class);
    $verification = app(OtpVerifier::class)->verify($registration->id, '123456', '127.0.0.1', $observation);

    expect($verification->accepted())->toBeFalse()
        ->and($registration->refresh()->status)->toBe(OtpRequestStatus::Pending)
        ->and(AuthenticatedSession::count())->toBe(0)
        ->and($login->request->refresh()->status)->toBe(OtpRequestStatus::Pending);
});

test('admission link is unique and preserves existing members', function () {
    $applicant = Applicant::factory()->create();
    $legacy = User::factory()->create();
    $member = User::factory()->create(['applicant_id' => $applicant->id]);

    expect($legacy->refresh()->applicant_id)->toBeNull()
        ->and($member->applicant->is($applicant))->toBeTrue()
        ->and($applicant->member->is($member))->toBeTrue();

    expect(fn () => User::factory()->create(['applicant_id' => $applicant->id]))
        ->toThrow(QueryException::class);
    expect(fn () => $applicant->delete())->toThrow(QueryException::class);
    $migration = require database_path('migrations/2026_11_27_000003_add_applicant_id_to_users_table.php');
    expect(fn () => $migration->down())->toThrow(RuntimeException::class);
});

test('starting and resuming share a normalized email and never duplicate open records', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $first = $lifecycle->start('  Candidate@Example.com ');
    $second = $lifecycle->start('candidate@example.com');

    expect($first)->toBeInstanceOf(Applicant::class)
        ->and($second->id)->toBe($first->id)
        ->and($first->events()->count())->toBe(1);

    $member = User::factory()->inactive()->create(['email' => 'Existing@Example.com']);
    expect($lifecycle->start('existing@example.com')->id)->toBe($member->id)
        ->and(Applicant::where('email', 'existing@example.com')->count())->toBe(0);
});

test('registration proof advances unverified and cannot be replayed', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $applicant = $lifecycle->start('candidate@example.com');
    $proof = applicationProof($applicant);
    $verified = $lifecycle->confirmEmail($proof);

    expect($verified->status)->toBe(ApplicantStatus::Draft)
        ->and($verified->email_verified_at)->not->toBeNull()
        ->and($verified->revision)->toBe(1)
        ->and($verified->events()->where('event_type', 'email_verified')->count())->toBe(1);

    expect(fn () => $lifecycle->confirmEmail($proof))->toThrow(ConflictHttpException::class);
    expect(fn () => $lifecycle->confirmEmail(OtpRequest::factory()->forApplicant($verified)->create()))
        ->toThrow(ConflictHttpException::class);
});

test('rejected application is preserved and a new application requires fresh proof', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $old = Applicant::factory()->rejected()->create();
    expect($lifecycle->start($old->email)->id)->toBe($old->id)
        ->and(Applicant::count())->toBe(1);
    $proof = applicationProof($old);
    $next = $lifecycle->confirmEmail($proof);

    expect($next->id)->not->toBe($old->id)
        ->and($next->status)->toBe(ApplicantStatus::Draft)
        ->and($old->refresh()->status)->toBe(ApplicantStatus::Rejected)
        ->and($proof->refresh()->applicant_id)->toBe($next->id)
        ->and($old->events()->where('event_type', 'reapplication')->count())->toBe(1)
        ->and(Applicant::where('email', $old->email)->count())->toBe(2);
});

test('submission validation and notification intent are atomic and idempotent', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $applicant = Applicant::factory()->draft()->create();
    $intentCount = 0;
    $validate = fn () => null;

    expect(fn () => $lifecycle->submit($applicant, $applicant->revision, $validate, fn () => throw new RuntimeException('outbox unavailable')))
        ->toThrow(RuntimeException::class);
    expect($applicant->refresh()->status)->toBe(ApplicantStatus::Draft)
        ->and($applicant->events()->count())->toBe(0);

    $intent = function () use (&$intentCount): void {
        $intentCount++;
    };
    $lifecycle->submit($applicant, $applicant->revision, $validate, $intent);
    $lifecycle->submit($applicant, $applicant->revision, $validate, $intent);

    expect($applicant->refresh()->status)->toBe(ApplicantStatus::Pending)
        ->and($intentCount)->toBe(1)
        ->and($applicant->events()->count())->toBe(1);
});

test('approval creates a single active member and rejects competing decisions', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $applicant = pendingApplication();
    $reviewer = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = $lifecycle->approve($applicant, $reviewer);

    expect($member->status)->toBe(User::STATUS_ACTIVE)
        ->and($member->member_type)->toBe(MemberType::MEMBER)
        ->and($member->name)->toBe('Test Candidate')
        ->and($member->applicant_id)->toBe($applicant->id)
        ->and($applicant->refresh()->status)->toBe(ApplicantStatus::Approved)
        ->and($applicant->reviewed_by)->toBe($reviewer->id)
        ->and($lifecycle->approve($applicant, $reviewer)->id)->toBe($member->id)
        ->and($lifecycle->start($applicant->email)->id)->toBe($member->id);

    expect(fn () => $lifecycle->reject($applicant, $reviewer))->toThrow(ConflictHttpException::class);
});

test('rejection never creates a member and only active admins can review', function () {
    $lifecycle = app(ApplicantLifecycle::class);
    $applicant = pendingApplication();
    $member = User::factory()->create();
    $inactive = User::factory()->inactive()->create(['member_type' => MemberType::ADMIN]);
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);

    expect(fn () => $lifecycle->approve($applicant, $member))->toThrow(AccessDeniedHttpException::class);
    expect(fn () => $lifecycle->reject($applicant, $inactive))->toThrow(AccessDeniedHttpException::class);

    $lifecycle->reject($applicant, $admin);
    $lifecycle->reject($applicant, $admin);
    expect($applicant->refresh()->status)->toBe(ApplicantStatus::Rejected)
        ->and($applicant->events()->count())->toBe(1)
        ->and($applicant->member)->toBeNull();
    expect(fn () => $lifecycle->approve($applicant, $admin))->toThrow(ConflictHttpException::class);
});

test('approval refuses a member email registered in the meantime', function () {
    $applicant = pendingApplication();
    User::factory()->create(['email' => strtoupper($applicant->email)]);
    $reviewer = User::factory()->create(['member_type' => MemberType::ADMIN]);
    expect(fn () => app(ApplicantLifecycle::class)->approve($applicant, $reviewer))
        ->toThrow(ConflictHttpException::class);
    expect($applicant->refresh()->status)->toBe(ApplicantStatus::Pending)
        ->and($applicant->member)->toBeNull();
});
