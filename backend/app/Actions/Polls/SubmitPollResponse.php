<?php

namespace App\Actions\Polls;

use App\Enums\PollVoteCancellationReason;
use App\Models\Poll;
use App\Models\PollVote;
use App\Models\User;
use Illuminate\Database\DatabaseManager;
use Illuminate\Validation\ValidationException;

class SubmitPollResponse
{
    public function __construct(private readonly DatabaseManager $database) {}

    public function handle(Poll $poll, User $user, array $changes): void
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
}
