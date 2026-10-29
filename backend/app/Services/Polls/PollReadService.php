<?php

namespace App\Services\Polls;

use App\Models\Poll;
use App\Models\PollVote;
use App\Models\User;
use App\Services\UserPreferenceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PollReadService
{
    public function __construct(
        private readonly UserPreferenceService $preferences,
        private readonly PollPayloadBuilder $payloads,
    ) {}

    public function resolve(string $identifier, ?User $viewer = null): Poll
    {
        return Poll::query()->where('slug', $identifier)
            ->with($this->payloadRelations($viewer))
            ->firstOrFail();
    }

    public function findBySlug(string $slug): ?Poll
    {
        return Poll::query()->where('slug', $slug)->first();
    }

    /**
     * @return array{polls: array<int, array<string, mixed>>, next_cursor: string|null, has_more: bool, synced_at: string}
     */
    public function listPayloads(int $limit = 3, ?string $cursor = null, ?Carbon $since = null, ?User $viewer = null): array
    {
        $snapshot = now();
        $cursorData = $cursor ? $this->decodeListCursor($cursor) : null;
        if ($cursorData) {
            $snapshot = $this->databaseDate($cursorData['snapshot']);
        }
        $since = $since?->setTimezone(config('app.timezone'));
        $query = Poll::query()->with($this->payloadRelations($viewer));

        if ($since) {
            $this->applyChangesSince($query, $since, $snapshot);
            $polls = $query
                ->orderByRaw($this->pollStatusOrder(), [$snapshot])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get();

            return [
                'polls' => $polls->map(fn (Poll $poll): array => $this->payloads->build($poll, $viewer))->values()->all(),
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
            'polls' => $polls->map(fn (Poll $poll): array => $this->payloads->build($poll, $viewer))->values()->all(),
            'next_cursor' => $hasMore && $lastPoll ? $this->encodeListCursor($lastPoll, $snapshot) : null,
            'has_more' => $hasMore,
            'synced_at' => $snapshot->toISOString(),
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

    /** @return array<int, string|array<string, mixed>> */
    private function payloadRelations(?User $viewer): array
    {
        $relations = [
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
        ];

        if ($viewer?->status === User::STATUS_ACTIVE) {
            $relations[] = 'activeVotes.user';
        }

        return $relations;
    }

    private function pollStatusOrder(): string
    {
        return 'CASE WHEN closed_at IS NULL OR closed_at > ? THEN 0 ELSE 1 END ASC';
    }

    /** @param array{status: int, created_at: string, id: string, snapshot: string} $cursor */
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
