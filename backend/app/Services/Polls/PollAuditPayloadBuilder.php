<?php

namespace App\Services\Polls;

use App\Models\Poll;
use App\Models\PollVote;
use App\Models\User;

class PollAuditPayloadBuilder
{
    /** @return array{poll: array<string, mixed>, events: array<int, array<string, mixed>>} */
    public function build(Poll $poll): array
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
}
