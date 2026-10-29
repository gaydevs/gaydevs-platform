<?php

namespace App\Services\Polls;

use App\Models\Poll;
use App\Models\PollOption;
use App\Models\User;

class PollPayloadBuilder
{
    /** @return array<string, mixed> */
    public function build(Poll $poll, ?User $viewer = null): array
    {
        $authenticated = $viewer instanceof User && $viewer->status === User::STATUS_ACTIVE;
        $votes = $poll->activeVotes;
        $totalVotes = $votes->count();
        $voteCounts = [];
        $selectedOptions = [];
        $votersByOption = [];
        $anonymousVoteCounts = [];

        foreach ($votes as $vote) {
            $optionId = $vote->poll_option_id;
            $voteCounts[$optionId] = ($voteCounts[$optionId] ?? 0) + 1;

            if ($authenticated) {
                if ($vote->user_id === $viewer->id) {
                    $selectedOptions[] = $optionId;
                }
                if ($vote->user_id === null) {
                    $anonymousVoteCounts[$optionId] = ($anonymousVoteCounts[$optionId] ?? 0) + 1;
                } else {
                    $votersByOption[$optionId][] = [
                        'id' => $vote->user_id,
                        'name' => $vote->user->name,
                    ];
                }
            }
        }

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
            'options' => $options->map(function (PollOption $option) use ($poll, $voteCounts, $percentages, $authenticated, $votersByOption, $anonymousVoteCounts): array {
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
                    $data['voters'] = $votersByOption[$option->id] ?? [];
                    $data['anonymous_votes'] = $anonymousVoteCounts[$option->id] ?? 0;
                }

                return $data;
            })->values()->all(),
        ];
    }

    /** @param array<int|string, float|int> $percentages
     * @return array<int|string, float|int>
     */
    private function roundedPercentages(array $percentages, bool $hasVotes): array
    {
        if (! $hasVotes) {
            return array_fill_keys(array_keys($percentages), 0);
        }

        return array_map(fn (float $percentage): float => round($percentage, 2), $percentages);
    }
}
