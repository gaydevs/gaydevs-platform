<?php

namespace App\Actions\Polls;

use App\Models\Poll;
use App\Models\User;
use Illuminate\Database\DatabaseManager;

class ClosePoll
{
    public function __construct(private readonly DatabaseManager $database) {}

    public function handle(Poll $poll, User $user): Poll
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
}
