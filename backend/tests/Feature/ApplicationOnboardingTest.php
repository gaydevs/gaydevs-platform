<?php

use App\Models\Applicant;
use App\Models\User;
use App\Models\UserPreference;
use App\Models\VisitorObservation;
use App\Services\ApplicationAvailability;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('public config is disabled by default and never exposes private configuration', function () {
    $this->getJson('/applications/config')->assertOk()->assertExactJson(['enabled' => false]);
    config([
        'applications.enabled' => true,
        'mail.from.address' => 'admin@example.test',
        'app.frontend_url' => 'http://localhost:5173/gaydevs/platform',
        'applications.support_whatsapp' => '5511999999999',
        'applications.turnstile' => ['sitekey' => 'public-test', 'secret' => 'private-test', 'hostname' => 'localhost', 'action' => 'application_otp'],
    ]);
    $this->getJson('/applications/config')->assertOk()->assertExactJson([
        'enabled' => true, 'sitekey' => 'public-test', 'action' => 'application_otp', 'cooldown' => 60,
    ]);
});

test('only admitted members receive onboarding and seen preference is persistent and idempotent', function () {
    $old = User::factory()->create();
    $this->actingAs($old)->getJson('/auth/session')->assertOk()->assertJsonMissingPath('user.onboarding_required');
    $this->postJson('/me/onboarding/seen')->assertForbidden();
    $applicant = Applicant::factory()->draft()->create(['status' => 'approved']);
    $member = User::factory()->create(['applicant_id' => $applicant->id]);
    UserPreference::create(['user_id' => $member->id, 'settings' => ['polls' => ['suggestions' => ['not_interested_poll_ids' => ['test']]]], 'version' => 1]);
    $this->actingAs($member)->getJson('/auth/session')->assertOk()->assertJsonPath('user.onboarding_required', true);
    $this->postJson('/me/onboarding/seen')->assertNoContent();
    $first = UserPreference::findOrFail($member->id);
    expect(data_get($first->settings, 'onboarding.seen_at'))->not->toBeNull()
        ->and(data_get($first->settings, 'polls.suggestions.not_interested_poll_ids'))->toBe(['test']);
    $this->postJson('/me/onboarding/seen')->assertNoContent();
    expect($first->fresh()->version)->toBe($first->version);
    $this->getJson('/auth/session')->assertOk()->assertJsonPath('user.onboarding_required', false)->assertJsonPath('user.onboarding_eligible', true);
});

test('production refuses activation while privacy terms are not finalized', function () {
    config([
        'applications.enabled' => true,
        'mail.from.address' => 'admin@example.test',
        'app.frontend_url' => 'https://example.test/platform',
        'applications.support_whatsapp' => '5511999999999',
        'applications.turnstile' => ['sitekey' => 'public-test', 'secret' => 'private-test', 'hostname' => 'example.test', 'action' => 'application_otp'],
        'mail.default' => 'smtp',
    ]);
    $original = app()->environment();
    app()->instance('env', 'production');
    try {
        $this->getJson('/applications/config')->assertOk()->assertExactJson(['enabled' => false]);
    } finally {
        app()->instance('env', $original);
    }
});

test('shared authentication observations redact private page referer', function () {
    $this->actingAs(User::factory()->create())->withHeaders(['Referer' => 'http://127.0.0.1:5173/gaydevs/platform/admin/applications/private-id?email=private@example.test'])
        ->getJson('/auth/session')->assertOk();
    $observation = VisitorObservation::query()->latest('id')->firstOrFail();
    expect($observation->referer)->toBeNull()->and($observation->path)->toBe('auth/session');
});

test('frontend URL requires HTTPS outside local and testing environments', function () {
    $original = app()->environment();
    app()->instance('env', 'production');
    try {
        expect(ApplicationAvailability::validFrontendUrl('http://localhost:5173/gaydevs/platform'))->toBeFalse()
            ->and(ApplicationAvailability::validFrontendUrl('https://example.test/platform'))->toBeTrue();
    } finally {
        app()->instance('env', $original);
    }
});
