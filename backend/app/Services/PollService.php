<?php

namespace App\Services;

use App\Enums\PollVoteCancellationReason;
use App\Models\Poll;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\User;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PollService
{
    public function __construct(
        private readonly PollSlugger $slugger,
        private readonly DatabaseManager $database,
        private readonly UserPreferenceService $preferences,
    ) {}

    public function resolve(string $identifier): Poll
    {
        return Poll::query()->where('slug', $identifier)->with([
            'creator',
            'closedBy',
            'options' => fn ($query) => $query
                ->whereNull('hidden_at')
                ->orderBy('created_at')
                ->orderBy('id'),
            'options.creator',
            'activeVotes' => fn ($query) => $query
                ->whereHas('option', fn ($optionQuery) => $optionQuery->whereNull('hidden_at'))
                ->orderBy('created_at')
                ->orderBy('id'),
            'activeVotes.user',
        ])->firstOrFail();
    }

    public function allPayloads(): array
    {
        return $this->listPayloads(1000000)['polls'];
    }

    /**
     * @return array{polls: array<int, array<string, mixed>>, next_cursor: string|null, has_more: bool, synced_at: string}
     */
    public function listPayloads(int $limit = 3, ?string $cursor = null, ?Carbon $since = null): array
    {
        $snapshot = now();
        $cursorData = $cursor ? $this->decodeListCursor($cursor) : null;
        if ($cursorData) {
            $snapshot = $this->databaseDate($cursorData['snapshot']);
        }
        $since = $since?->setTimezone(config('app.timezone'));

        $query = Poll::query();

        if ($since) {
            $this->applyChangesSince($query, $since, $snapshot);
            $polls = $query
                ->orderByRaw($this->pollStatusOrder(), [$snapshot])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get();

            return [
                'polls' => $polls->map(fn (Poll $poll): array => $this->payload($this->resolve($poll->slug)))->values()->all(),
                'next_cursor' => null,
                'has_more' => false,
                'synced_at' => $snapshot->toISOString(),
            ];
        }

        $query->where('created_at', '<=', $snapshot);
        if ($cursorData) {
            $this->applyListCursor($query, $cursorData);
        }

        $page = $query
            ->orderByRaw($this->pollStatusOrder(), [$snapshot])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();
        $hasMore = $page->count() > $limit;
        $polls = $page->take($limit)->values();
        $lastPoll = $polls->last();

        return [
            'polls' => $polls->map(fn (Poll $poll): array => $this->payload($this->resolve($poll->slug)))->values()->all(),
            'next_cursor' => $hasMore && $lastPoll ? $this->encodeListCursor($lastPoll, $snapshot) : null,
            'has_more' => $hasMore,
            'synced_at' => $snapshot->toISOString(),
        ];
    }

    public function create(User $user, array $data): Poll
    {
        $attempt = 0;
        while (true) {
            try {
                return $this->database->transaction(function () use ($user, $data): Poll {
                    $allowNewOptions = (bool) ($data['allow_new_options'] ?? false);
                    $this->assertUniqueOptionLabels($data['options'], $allowNewOptions);
                    $poll = new Poll([
                        'created_by_user_id' => $user->id,
                        'question' => trim($data['question']),
                        'allow_multiple' => (bool) ($data['allow_multiple'] ?? false),
                        'allow_new_options' => $allowNewOptions,
                    ]);
                    if ($this->slugger->base($poll->question) === '') {
                        throw ValidationException::withMessages(['question' => 'A pergunta precisa gerar um slug válido.']);
                    }
                    $poll->slug = $this->slugger->uniqueFor($poll);
                    $poll->save();
                    foreach ($data['options'] as $label) {
                        if ($allowNewOptions && trim((string) $label) === '') {
                            continue;
                        }
                        $poll->options()->create(['label' => $label, 'created_by_user_id' => $user->id]);
                    }

                    return $poll->load(['creator', 'options.creator']);
                });
            } catch (QueryException $exception) {
                $attempt++;
                if (! $this->isSlugCollision($exception) || $attempt >= 3) {
                    throw $exception;
                }
            }
        }
    }

    public function payload(Poll $poll): array
    {
        $user = Auth::guard('sanctum')->user();
        $authenticated = $user instanceof User && $user->status === User::STATUS_ACTIVE;
        $votes = $poll->activeVotes;
        $totalVotes = $votes->count();
        $voteCounts = $votes->countBy('poll_option_id');

        $selectedOptions = $authenticated
            ? $votes->where('user_id', $user->id)->pluck('poll_option_id')->values()->all()
            : [];

        $percentages = [];
        foreach ($poll->options as $option) {
            $percentages[$option->id] = $totalVotes > 0
                ? (($voteCounts[$option->id] ?? 0) / $totalVotes) * 100
                : 0.0;
        }
        $options = $poll->options->sort(function (PollOption $left, PollOption $right) use ($voteCounts): int {
            $voteCountComparison = ($voteCounts[$right->id] ?? 0) <=> ($voteCounts[$left->id] ?? 0);
            if ($voteCountComparison !== 0) {
                return $voteCountComparison;
            }

            $leftCreatedAt = $left->created_at?->getTimestamp() ?? 0;
            $rightCreatedAt = $right->created_at?->getTimestamp() ?? 0;
            $createdAtComparison = $leftCreatedAt <=> $rightCreatedAt;

            return $createdAtComparison !== 0 ? $createdAtComparison : ($left->id <=> $right->id);
        })->values();
        $percentages = $this->roundedPercentages($percentages, $totalVotes > 0);

        return [
            'id' => $poll->id,
            'slug' => $poll->slug,
            'created_at' => $poll->created_at?->toISOString(),
            'creator' => ['id' => $poll->creator->id, 'name' => $poll->creator->name],
            'question' => $poll->question,
            'started_at' => $poll->started_at?->toISOString(),
            'started_on' => $poll->started_on?->toDateString(),
            'allow_multiple' => $poll->allow_multiple,
            'allow_new_options' => $poll->allow_new_options,
            'closed' => $poll->isClosed(),
            'closed_at' => $poll->closed_at?->toISOString(),
            'has_votes' => $totalVotes > 0,
            'total_votes' => $totalVotes,
            'message' => $totalVotes > 0 ? null : 'Ainda não há votos',
            'selected_options' => $selectedOptions,
            'options' => $options->map(function (PollOption $option) use ($poll, $voteCounts, $percentages, $authenticated): array {
                $votes = $poll->activeVotes->where('poll_option_id', $option->id);
                $data = [
                    'id' => $option->id,
                    'label' => $option->label,
                    'created_at' => $option->created_at?->toISOString(),
                    'votes' => $voteCounts[$option->id] ?? 0,
                    'percentage' => $percentages[$option->id] ?? 0,
                ];
                if ($option->creator && $option->created_by_user_id !== $poll->created_by_user_id) {
                    $data['creator'] = ['id' => $option->creator->id, 'name' => $option->creator->name];
                }
                if ($authenticated) {
                    $data['voters'] = $votes->filter(fn (PollVote $vote): bool => $vote->user_id !== null)->map(fn (PollVote $vote): array => [
                        'id' => $vote->user_id,
                        'name' => $vote->user->name,
                    ])->values()->all();
                    $data['anonymous_votes'] = $votes->whereNull('user_id')->count();
                }

                return $data;
            })->values()->all(),
        ];
    }

    /** @return array{poll: array<string, mixed>, suggested_polls: array<int, array{id: string, slug: string, question: string, started_at: string|null, started_on: string|null, options_count: int, total_votes: int}>} */
    public function responsePayload(Poll $poll, User $user, bool $includeSuggestions = true): array
    {
        return [
            'poll' => $this->payload($poll),
            'suggested_polls' => $includeSuggestions ? $this->suggestionsFor($poll, $user) : [],
        ];
    }

    /** @return array<int, array{id: string, slug: string, question: string, started_at: string|null, started_on: string|null, options_count: int, total_votes: int}> */
    public function suggestionsFor(Poll $currentPoll, User $user): array
    {
        if ($this->preferences->pollSuggestionsAreSnoozed($user)) {
            return [];
        }

        $now = now();
        $notInterestedPollIds = $this->preferences->notInterestedPollIds($user);

        return Poll::query()
            ->whereKeyNot($currentPoll->id)
            ->when($notInterestedPollIds !== [], fn (Builder $query): Builder => $query->whereNotIn('id', $notInterestedPollIds))
            ->where(function (Builder $query) use ($now): void {
                $query->whereNull('closed_at')->orWhere('closed_at', '>', $now);
            })
            ->whereHas('options', fn (Builder $query): Builder => $query->whereNull('hidden_at'))
            ->whereDoesntHave('votes', function (Builder $query) use ($user): void {
                $query->where('user_id', $user->id)->where('status', PollVote::STATUS_ACTIVE);
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(3)
            ->withCount([
                'options as options_count' => fn (Builder $query): Builder => $query->whereNull('hidden_at'),
                'votes as total_votes' => fn (Builder $query): Builder => $query
                    ->where('status', PollVote::STATUS_ACTIVE)
                    ->whereHas('option', fn (Builder $optionQuery): Builder => $optionQuery->whereNull('hidden_at')),
            ])
            ->get(['id', 'slug', 'question', 'started_at', 'started_on'])
            ->map(fn (Poll $poll): array => [
                'id' => $poll->id,
                'slug' => $poll->slug,
                'question' => $poll->question,
                'started_at' => $poll->started_at?->toISOString(),
                'started_on' => $poll->started_on?->toDateString(),
                'options_count' => (int) $poll->options_count,
                'total_votes' => (int) $poll->total_votes,
            ])
            ->values()
            ->all();
    }

    public function close(Poll $poll, User $user): Poll
    {
        return $this->database->transaction(function () use ($poll, $user): Poll {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            if (! $lockedPoll->closed_at) {
                $lockedPoll->update([
                    'closed_at' => now(),
                    'closed_by_user_id' => $user->id,
                ]);
            }

            return $lockedPoll->fresh(['creator', 'closedBy', 'options.creator']);
        });
    }

    public function auditPayload(Poll $poll): array
    {
        $options = $poll->options()->with(['creator', 'hiddenBy'])
            ->orderBy('created_at')->orderBy('id')->get();
        $votes = $poll->votes()->with([
            'option',
            'user',
        ])->orderBy('created_at')->orderBy('id')->get();
        $actor = static fn (?User $user): ?array => $user ? ['id' => $user->id, 'name' => $user->name] : null;
        $events = [[
            'id' => 'poll-'.$poll->id.'-created',
            'type' => 'poll_created',
            'actor' => $actor($poll->creator),
            'at' => $poll->created_at?->toISOString(),
        ]];

        foreach ($options as $option) {
            $events[] = [
                'id' => 'option-'.$option->id.'-created',
                'type' => 'option_added',
                'option_id' => $option->id,
                'option_label' => $option->label,
                'actor' => $actor($option->creator),
                'at' => $option->created_at?->toISOString(),
            ];
            if ($option->hidden_at) {
                $events[] = [
                    'id' => 'option-'.$option->id.'-hidden',
                    'type' => 'option_hidden',
                    'option_id' => $option->id,
                    'option_label' => $option->label,
                    'actor' => $actor($option->hiddenBy),
                    'at' => $option->hidden_at->toISOString(),
                ];
            }
        }

        foreach ($votes as $vote) {
            $events[] = [
                'id' => 'vote-'.$vote->id.'-created',
                'type' => 'vote_recorded',
                'vote_id' => $vote->id,
                'option_id' => $vote->poll_option_id,
                'option_label' => $vote->option?->label ?? 'Opção removida',
                'actor' => $actor($vote->user),
                'at' => $vote->created_at?->toISOString(),
            ];
            if ($vote->status === PollVote::STATUS_CANCELED) {
                $events[] = [
                    'id' => 'vote-'.$vote->id.'-canceled',
                    'type' => 'vote_canceled',
                    'vote_id' => $vote->id,
                    'option_id' => $vote->poll_option_id,
                    'option_label' => $vote->option?->label ?? 'Opção removida',
                    'actor' => $actor($vote->user),
                    'at' => $vote->canceled_at?->toISOString(),
                    'cancellation_reason' => $vote->cancellation_reason?->value,
                ];
            }
        }

        if ($poll->closed_at) {
            $events[] = [
                'id' => 'poll-'.$poll->id.'-closed',
                'type' => 'poll_closed',
                'actor' => $actor($poll->closedBy),
                'at' => $poll->closed_at->toISOString(),
            ];
        }
        $eventTypeOrder = [
            'poll_created' => 0,
            'option_added' => 1,
            'option_hidden' => 2,
            'vote_recorded' => 3,
            'vote_canceled' => 4,
            'poll_closed' => 5,
        ];
        usort($events, static function (array $left, array $right) use ($eventTypeOrder): int {
            $leftAt = $left['at'] === null ? PHP_INT_MIN : strtotime($left['at']);
            $rightAt = $right['at'] === null ? PHP_INT_MIN : strtotime($right['at']);
            if ($leftAt !== $rightAt) {
                return $leftAt <=> $rightAt;
            }

            return ($eventTypeOrder[$left['type']] ?? PHP_INT_MAX) <=> ($eventTypeOrder[$right['type']] ?? PHP_INT_MAX);
        });

        return [
            'poll' => [
                'id' => $poll->id,
                'slug' => $poll->slug,
                'question' => $poll->question,
                'creator' => $actor($poll->creator),
                'created_at' => $poll->created_at?->toISOString(),
                'closed_at' => $poll->closed_at?->toISOString(),
            ],
            'events' => $events,
        ];
    }

    public function submit(Poll $poll, User $user, array $changes): void
    {
        $this->database->transaction(function () use ($poll, $user, $changes): void {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            if ($lockedPoll->isClosed()) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete está encerrada.']);
            }

            $addedOptionIds = array_values(array_unique($changes['added_options'] ?? []));
            $removedOptionIds = array_values(array_unique($changes['removed_options'] ?? []));
            if (array_intersect($addedOptionIds, $removedOptionIds) !== []) {
                throw ValidationException::withMessages(['options' => 'Uma opção não pode ser adicionada e removida na mesma alteração.']);
            }

            $requestedOptionIds = array_values(array_unique([...$addedOptionIds, ...$removedOptionIds]));
            $valid = $lockedPoll->options()->whereNull('hidden_at')->whereIn('id', $requestedOptionIds)->count();
            if ($valid !== count($requestedOptionIds)) {
                throw ValidationException::withMessages(['options' => 'Uma ou mais opções estão ocultas ou são inválidas.']);
            }

            $activeVotes = PollVote::query()->where('poll_id', $lockedPoll->id)
                ->where('user_id', $user->id)
                ->where('status', PollVote::STATUS_ACTIVE)
                ->get();
            $activeOptionIds = array_values(array_unique($activeVotes->pluck('poll_option_id')->all()));
            $effectiveOptionIds = array_values(array_diff($activeOptionIds, $removedOptionIds));
            foreach ($addedOptionIds as $optionId) {
                if (! in_array($optionId, $effectiveOptionIds, true)) {
                    $effectiveOptionIds[] = $optionId;
                }
            }

            if (! $lockedPoll->allow_multiple && count($effectiveOptionIds) > 1) {
                throw ValidationException::withMessages(['options' => 'Escolha apenas uma opção.']);
            }

            $cancellationReason = ! $lockedPoll->allow_multiple && $addedOptionIds !== []
                ? PollVoteCancellationReason::REPLACED
                : PollVoteCancellationReason::WITHDRAWN;
            $activeVotes->whereIn('poll_option_id', $removedOptionIds)->each(function (PollVote $vote) use ($cancellationReason): void {
                $vote->update([
                    'status' => PollVote::STATUS_CANCELED,
                    'cancellation_reason' => $cancellationReason,
                    'canceled_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            foreach (array_diff($addedOptionIds, $activeOptionIds) as $optionId) {
                PollVote::query()->create([
                    'poll_id' => $lockedPoll->id,
                    'poll_option_id' => $optionId,
                    'user_id' => $user->id,
                ]);
            }
        });
    }

    public function addOption(Poll $poll, User $user, string $label): PollOption
    {
        return $this->database->transaction(function () use ($poll, $user, $label): PollOption {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            if ($lockedPoll->isClosed()) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete está encerrada.']);
            }
            if (! $lockedPoll->allow_new_options) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete não permite novas opções.']);
            }
            if ($this->normalizedOptionLabel($label) === '') {
                throw ValidationException::withMessages(['label' => 'Informe uma opção.']);
            }

            $normalizedLabel = $this->normalizedOptionLabel($label);
            $similar = $lockedPoll->options()->get(['id', 'label', 'hidden_at'])->first(
                fn (PollOption $option): bool => $this->normalizedOptionLabel($option->label) === $normalizedLabel,
            );
            if ($similar) {
                $message = $similar->hidden_at
                    ? 'A opção semelhante está ocultada: "'.$similar->label.'".'
                    : 'Já existe uma opção semelhante: "'.$similar->label.'".';
                throw ValidationException::withMessages(['label' => $message]);
            }

            return $lockedPoll->options()->create(['label' => $label, 'created_by_user_id' => $user->id]);
        });
    }

    public function hideOption(Poll $poll, PollOption $option, User $user, bool $admin = false): void
    {
        $this->database->transaction(function () use ($poll, $option, $user, $admin): void {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            $lockedOption = PollOption::query()->whereKey($option->id)->lockForUpdate()->firstOrFail();
            if ($lockedPoll->isClosed()) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete está encerrada.']);
            }
            if ($lockedOption->poll_id !== $lockedPoll->id || $lockedOption->hidden_at) {
                abort(404);
            }
            $minimumVisibleOptions = $lockedPoll->allow_new_options ? 1 : 2;
            $visibleOptionCount = $lockedPoll->options()->whereNull('hidden_at')->count();
            if ($visibleOptionCount <= $minimumVisibleOptions) {
                throw ValidationException::withMessages(['options' => 'A enquete precisa manter pelo menos '.$minimumVisibleOptions.' opções.']);
            }
            if (! $admin && $lockedOption->created_by_user_id !== $user->id) {
                abort(403);
            }
            if (! $admin && $lockedOption->activeVotes()->where(function ($query) use ($user): void {
                $query->whereNull('user_id')->orWhere('user_id', '!=', $user->id);
            })->exists()) {
                throw ValidationException::withMessages(['option' => 'Esta opção já recebeu votos de outros gdevs.']);
            }

            $now = now();
            $lockedOption->update(['hidden_at' => $now, 'hidden_by_user_id' => $user->id]);
            $lockedOption->activeVotes()->update([
                'status' => PollVote::STATUS_CANCELED,
                'cancellation_reason' => PollVoteCancellationReason::OPTION_HIDDEN,
                'canceled_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function removeOption(Poll $poll, PollOption $option, User $user): void
    {
        $this->hideOption($poll, $option, $user);
    }

    private function roundedPercentages(array $percentages, bool $hasVotes): array
    {
        if (! $hasVotes) {
            return array_fill_keys(array_keys($percentages), 0);
        }

        $rounded = array_map(fn (float $percentage): float => round($percentage, 2), $percentages);

        return $rounded;
    }

    private function assertUniqueOptionLabels(array $labels, bool $allowNewOptions = false): void
    {
        $normalizedLabels = [];
        foreach ($labels as $index => $label) {
            $normalizedLabel = $this->normalizedOptionLabel((string) $label);
            if ($normalizedLabel === '') {
                if ($allowNewOptions && $index > 0) {
                    continue;
                }
                throw ValidationException::withMessages(["options.$index" => 'A opção '.($index + 1).' é obrigatória.']);
            }
            if (isset($normalizedLabels[$normalizedLabel])) {
                throw ValidationException::withMessages(["options.$index" => 'A opção '.($index + 1).' está repetida.']);
            }
            $normalizedLabels[$normalizedLabel] = true;
        }
    }

    private function normalizedOptionLabel(string $label): string
    {
        $ascii = Str::lower(Str::ascii($label));
        $withoutSpecialCharacters = preg_replace('/[^a-z0-9\s]/', '', $ascii) ?? '';

        return trim(preg_replace('/\s+/', ' ', $withoutSpecialCharacters) ?? '');
    }

    private function isSlugCollision(QueryException $exception): bool
    {
        $message = Str::lower($exception->getMessage());

        return Str::contains($message, 'slug') && Str::contains($message, 'unique');
    }

    private function pollStatusOrder(): string
    {
        return 'CASE WHEN closed_at IS NULL OR closed_at > ? THEN 0 ELSE 1 END ASC';
    }

    private function applyListCursor(Builder $query, array $cursor): void
    {
        $snapshot = $this->databaseDate($cursor['snapshot']);
        $statusOrder = 'CASE WHEN closed_at IS NULL OR closed_at > ? THEN 0 ELSE 1 END';
        $query->where(function (Builder $query) use ($cursor, $snapshot, $statusOrder): void {
            $query->whereRaw($statusOrder.' > ?', [$snapshot, $cursor['status']])
                ->orWhere(function (Builder $query) use ($cursor, $snapshot, $statusOrder): void {
                    $query->whereRaw($statusOrder.' = ?', [$snapshot, $cursor['status']])
                        ->where(function (Builder $query) use ($cursor): void {
                            $query->where('created_at', '<', $this->databaseDate($cursor['created_at']))
                                ->orWhere(function (Builder $query) use ($cursor): void {
                                    $query->where('created_at', $this->databaseDate($cursor['created_at']))
                                        ->where('id', '<', $cursor['id']);
                                });
                        });
                });
        });
    }

    private function applyChangesSince(Builder $query, Carbon $since, Carbon $snapshot): void
    {
        $withinWindow = static function (Builder $query, string $column, Carbon $since, Carbon $snapshot): void {
            // The database timestamps are second-precision in some installations;
            // overlap the boundary so a change in the same second is not missed.
            $query->where($column, '>=', $since)->where($column, '<=', $snapshot);
        };

        $query->where(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
            $withinWindow($query, 'created_at', $since, $snapshot);
            $query->orWhere(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                $withinWindow($query, 'updated_at', $since, $snapshot);
            });
            $query->orWhereHas('options', function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                $query->where(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                    $withinWindow($query, 'created_at', $since, $snapshot);
                    $query->orWhere(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                        $withinWindow($query, 'updated_at', $since, $snapshot);
                    });
                });
            });
            $query->orWhereHas('votes', function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                $query->where(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                    $withinWindow($query, 'created_at', $since, $snapshot);
                    $query->orWhere(function (Builder $query) use ($since, $snapshot, $withinWindow): void {
                        $withinWindow($query, 'updated_at', $since, $snapshot);
                    });
                });
            });
        });
    }

    /** @return array{status: int, created_at: string, id: string, snapshot: string} */
    private function decodeListCursor(string $cursor): array
    {
        $decoded = base64_decode($cursor, true);
        $data = is_string($decoded) ? json_decode($decoded, true) : null;
        if (! is_array($data) || ! isset($data['status'], $data['created_at'], $data['id'], $data['snapshot']) || ! in_array($data['status'], [0, 1], true)) {
            throw ValidationException::withMessages(['cursor' => 'O cursor da listagem é inválido.']);
        }

        try {
            Carbon::parse($data['created_at']);
            Carbon::parse($data['snapshot']);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['cursor' => 'O cursor da listagem é inválido.']);
        }

        return $data;
    }

    private function encodeListCursor(Poll $poll, Carbon $snapshot): string
    {
        return base64_encode((string) json_encode([
            'status' => $poll->closed_at && $poll->closed_at->lte($snapshot) ? 1 : 0,
            'created_at' => $poll->created_at?->toISOString(),
            'id' => $poll->id,
            'snapshot' => $snapshot->toISOString(),
        ], JSON_THROW_ON_ERROR));
    }

    private function databaseDate(string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(config('app.timezone'));
    }
}
