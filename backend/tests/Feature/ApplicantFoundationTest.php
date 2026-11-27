<?php

use App\Enums\ApplicantStatus;
use App\Models\Applicant;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

uses(RefreshDatabase::class);

test('applicant uses uuid v7 and normalizes email without exposing private data', function () {
    $applicant = Applicant::factory()->create(['email' => '  Candidate@Example.com  '])->refresh();

    expect(Uuid::fromString($applicant->id)->getFields()->getVersion())->toBe(7)
        ->and($applicant->email)->toBe('candidate@example.com')
        ->and($applicant->active_email)->toBe('candidate@example.com')
        ->and($applicant->status)->toBe(ApplicantStatus::Unverified)
        ->and($applicant->toArray())->not->toHaveKey('email')
        ->and($applicant->toArray())->not->toHaveKey('active_email')
        ->and($applicant->toArray())->not->toHaveKey('admin_notes');
});

test('database allows historical duplicate emails but refuses a second active application', function () {
    $email = 'candidate@example.com';
    $old = Applicant::factory()->rejected()->create(['email' => $email])->refresh();
    $another = Applicant::factory()->rejected()->create(['email' => $email])->refresh();
    $draft = Applicant::factory()->draft()->create(['email' => $email])->refresh();

    expect($old->active_email)->toBeNull()
        ->and($another->active_email)->toBeNull()
        ->and($draft->active_email)->toBe($email)
        ->and(Applicant::where('email', $email)->count())->toBe(3);

    expect(fn () => Applicant::factory()->create(['email' => strtoupper($email)]))
        ->toThrow(QueryException::class);
});

test('database automatically releases the active email on terminal status', function () {
    $applicant = Applicant::factory()->draft()->create();

    DB::table('applicants')->where('id', $applicant->id)->update(['status' => 'pending']);
    expect($applicant->refresh()->active_email)->toBe($applicant->email);

    DB::table('applicants')->where('id', $applicant->id)->update(['status' => 'rejected']);
    expect($applicant->refresh()->active_email)->toBeNull();

    $next = Applicant::factory()->create(['email' => $applicant->email]);
    expect($next->refresh()->active_email)->toBe($applicant->email)
        ->and($next->id)->not->toBe($applicant->id);
});

test('database refuses reactivation of history if an open application exists', function () {
    $old = Applicant::factory()->rejected()->create();
    Applicant::factory()->create(['email' => $old->email]);

    expect(fn () => DB::table('applicants')->where('id', $old->id)->update(['status' => 'draft']))
        ->toThrow(QueryException::class);
});

test('consent versions are preserved and duplicate versions rejected', function () {
    $applicant = Applicant::factory()->draft()->create();
    $applicant->consents()->create(['consent_key' => 'privacy', 'version' => 'v1', 'accepted_at' => now()]);
    $applicant->consents()->create(['consent_key' => 'privacy', 'version' => 'v2', 'accepted_at' => now()]);

    expect($applicant->consents()->count())->toBe(2);

    expect(fn () => $applicant->consents()->create([
        'consent_key' => 'privacy', 'version' => 'v2', 'accepted_at' => now(),
    ]))->toThrow(QueryException::class);
});

test('event keys are unique per applicant and identify the administrator', function () {
    $applicant = Applicant::factory()->draft()->create();
    $actor = User::factory()->create();
    $data = [
        'event_key' => 'status:rejected',
        'event_type' => 'rejected',
        'occurred_at' => now(),
        'actor_user_id' => $actor->id,
    ];

    $event = $applicant->events()->create($data);
    expect($event->actor->is($actor))->toBeTrue();

    expect(fn () => $applicant->events()->create($data))->toThrow(QueryException::class);
});

test('application change and audit record roll back together', function () {
    $applicant = Applicant::factory()->draft()->create();

    expect(fn () => DB::transaction(function () use ($applicant): void {
        $applicant->forceFill(['status' => ApplicantStatus::Pending])->save();
        $applicant->events()->create([
            'event_key' => 'status:pending',
            'event_type' => 'submitted',
            'occurred_at' => now(),
        ]);

        throw new RuntimeException('simulated failure');
    }))->toThrow(RuntimeException::class);

    expect($applicant->refresh()->status)->toBe(ApplicantStatus::Draft)
        ->and($applicant->events()->count())->toBe(0);
});

test('foreign keys preserve application audit history', function () {
    $applicant = Applicant::factory()->draft()->create();
    $applicant->consents()->create(['consent_key' => 'rules', 'version' => 'v1', 'accepted_at' => now()]);

    expect(fn () => $applicant->delete())->toThrow(QueryException::class);
});
