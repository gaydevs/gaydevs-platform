<?php

namespace App\Actions\Polls;

use App\Enums\PollVoteCancellationReason;
use App\Models\Poll;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;

class HidePollOption
{
    public function __construct(private readonly DatabaseManager $database) {}

    public function handle(Poll $poll, PollOption $option, User $user, bool $admin = false): void
    {
        $this->database->transaction(function () use ($poll, $option, $user, $admin): void {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            $lockedOption = PollOption::query()->whereKey($option->id)->lockForUpdate()->firstOrFail();
            if ($lockedPoll->isClosed()) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete está encerrada.']);
            }
            if ($lockedOption->poll_id !== $lockedPoll->id || $lockedOption->hidden_at) {
                throw (new ModelNotFoundException)->setModel(PollOption::class, [$option->id]);
            }
            $minimumVisibleOptions = $lockedPoll->allow_new_options ? 1 : 2;
            $visibleOptionCount = $lockedPoll->options()->whereNull('hidden_at')->count();
            if ($visibleOptionCount <= $minimumVisibleOptions) {
                throw ValidationException::withMessages(['options' => 'A enquete precisa manter pelo menos '.$minimumVisibleOptions.' opções.']);
            }
            if (! $admin && $lockedOption->created_by_user_id !== $user->id) {
                throw new AuthorizationException;
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
}
