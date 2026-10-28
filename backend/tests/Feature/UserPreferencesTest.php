<?php

use App\Models\Poll;
use App\Models\PollOption;
use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('authenticated user preferences are stored as JSON and returned on another request', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/me/preferences')
        ->assertOk()
        ->assertJsonPath('preferences.polls.suggestions.snooze_until', null);

    $this->postJson('/me/preferences/poll-suggestions/snooze', ['hours' => 24])
        ->assertOk()
        ->assertJsonPath('preferences.polls.suggestions.snooze_until', fn ($value): bool => is_string($value));

    $stored = UserPreference::query()->where('user_id', $user->id)->sole();
    expect(data_get($stored->settings, 'polls.suggestions.snooze_until'))->toBeString()
        ->and($stored->version)->toBe(1)
        ->and(json_decode($stored->getRawOriginal('settings'), true))->toHaveKey('polls.suggestions.snooze_until');

    $this->getJson('/me/preferences')
        ->assertOk()
        ->assertJsonPath('preferences.polls.suggestions.snooze_until', data_get($stored->settings, 'polls.suggestions.snooze_until'));
});

test('snooze duration cannot exceed 24 hours and requires authentication', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->postJson('/me/preferences/poll-suggestions/snooze', ['hours' => 25])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['hours']);
    expect(UserPreference::query()->count())->toBe(0);

    auth()->forgetGuards();
    $this->postJson('/me/preferences/poll-suggestions/snooze', ['hours' => 24])->assertUnauthorized();
});

test('snoozed users do not receive poll suggestions after voting', function () {
    $creator = User::factory()->create();
    $voter = User::factory()->create();
    $current = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete atual de jogos',
        'slug' => 'enquete-atual-de-jogos',
    ]);
    $currentOption = PollOption::create(['poll_id' => $current->id, 'label' => 'Jogo A']);
    $suggested = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Outra enquete aberta',
        'slug' => 'outra-enquete-aberta',
    ]);
    PollOption::create(['poll_id' => $suggested->id, 'label' => 'Opção']);

    Sanctum::actingAs($voter);
    $this->postJson('/me/preferences/poll-suggestions/snooze', ['hours' => 24])->assertOk();

    $this->postJson('/polls/'.$current->slug.'/responses', [
        'added_options' => [$currentOption->id],
        'removed_options' => [],
    ])->assertOk()->assertJsonCount(0, 'suggested_polls');
});

test('a user can permanently dismiss one poll suggestion in the JSON preferences', function () {
    $user = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $user->id,
        'question' => 'Enquete que não quero responder',
        'slug' => 'enquete-nao-quero-responder',
    ]);
    Sanctum::actingAs($user);

    $this->postJson('/me/preferences/poll-suggestions/dismiss', ['poll_id' => $poll->id])
        ->assertOk()
        ->assertJsonPath('preferences.polls.suggestions.not_interested_poll_ids.0', $poll->id);

    expect(data_get(UserPreference::query()->findOrFail($user->id)->settings, 'polls.suggestions.not_interested_poll_ids'))
        ->toBe([$poll->id]);
});

test('user preferences prevent deleting the referenced user', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $this->postJson('/me/preferences/poll-suggestions/snooze', ['hours' => 24])->assertOk();

    expect(fn () => $user->delete())->toThrow(QueryException::class);
    expect(UserPreference::query()->where('user_id', $user->id)->exists())->toBeTrue();
});
