<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class UserPreferenceService
{
    public const POLL_SUGGESTIONS_SNOOZE_UNTIL = 'polls.suggestions.snooze_until';

    public const POLL_SUGGESTIONS_NOT_INTERESTED = 'polls.suggestions.not_interested_poll_ids';

    public function __construct(private readonly DatabaseManager $database) {}

    /** @return array{polls: array{suggestions: array{snooze_until: string|null, not_interested_poll_ids: array<int, string>}}} */
    public function all(User $user): array
    {
        $settings = $this->storedSettings($user);
        $snoozeUntil = data_get($settings, self::POLL_SUGGESTIONS_SNOOZE_UNTIL);

        if (is_string($snoozeUntil) && Carbon::parse($snoozeUntil)->isPast()) {
            $snoozeUntil = null;
        }

        $notInterestedPollIds = $this->notInterestedPollIdsFrom($settings);

        return [
            'polls' => [
                'suggestions' => [
                    'snooze_until' => is_string($snoozeUntil) ? $snoozeUntil : null,
                    'not_interested_poll_ids' => $notInterestedPollIds,
                ],
            ],
        ];
    }

    public function pollSuggestionsAreSnoozed(User $user): bool
    {
        $snoozeUntil = data_get($this->storedSettings($user), self::POLL_SUGGESTIONS_SNOOZE_UNTIL);

        return is_string($snoozeUntil) && Carbon::parse($snoozeUntil)->isFuture();
    }

    public function snoozePollSuggestions(User $user, int $hours = 24): array
    {
        if ($hours < 1 || $hours > 24) {
            throw ValidationException::withMessages([
                'hours' => 'O adiamento das sugestões deve durar entre 1 e 24 horas.',
            ]);
        }

        $snoozeUntil = now()->addHours($hours)->utc()->toISOString();

        $this->database->transaction(function () use ($user, $snoozeUntil): void {
            $preference = UserPreference::query()->lockForUpdate()->firstOrNew(['user_id' => $user->id]);
            $settings = $preference->settings ?? [];
            data_set($settings, self::POLL_SUGGESTIONS_SNOOZE_UNTIL, $snoozeUntil);
            $preference->settings = $settings;
            $preference->version = $preference->exists ? $preference->version + 1 : 1;
            $preference->save();
        });

        return $this->all($user->fresh('preference'));
    }

    /** @return array<int, string> */
    public function notInterestedPollIds(User $user): array
    {
        return $this->notInterestedPollIdsFrom($this->storedSettings($user));
    }

    /** @return array{polls: array{suggestions: array{snooze_until: string|null, not_interested_poll_ids: array<int, string>}}} */
    public function dismissPollSuggestion(User $user, string $pollId): array
    {
        $this->database->transaction(function () use ($user, $pollId): void {
            $preference = UserPreference::query()->lockForUpdate()->firstOrNew(['user_id' => $user->id]);
            $settings = $preference->settings ?? [];
            $pollIds = $this->notInterestedPollIdsFrom($settings);
            if (! in_array($pollId, $pollIds, true)) {
                $pollIds[] = $pollId;
            }
            data_set($settings, self::POLL_SUGGESTIONS_NOT_INTERESTED, $pollIds);
            $preference->settings = $settings;
            $preference->version = $preference->exists ? $preference->version + 1 : 1;
            $preference->save();
        });

        return $this->all($user->fresh('preference'));
    }

    /** @return array<string, mixed> */
    private function storedSettings(User $user): array
    {
        return UserPreference::query()->find($user->id)?->settings ?? [];
    }

    /** @param array<string, mixed> $settings @return array<int, string> */
    private function notInterestedPollIdsFrom(array $settings): array
    {
        $pollIds = data_get($settings, self::POLL_SUGGESTIONS_NOT_INTERESTED, []);

        return is_array($pollIds)
            ? array_values(array_unique(array_filter($pollIds, static fn (mixed $pollId): bool => is_string($pollId))))
            : [];
    }
}
