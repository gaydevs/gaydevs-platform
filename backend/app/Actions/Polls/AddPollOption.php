<?php

namespace App\Actions\Polls;

use App\Models\Poll;
use App\Models\PollOption;
use App\Models\User;
use App\Services\Polls\PollOptionLabelRules;
use Illuminate\Database\DatabaseManager;
use Illuminate\Validation\ValidationException;

class AddPollOption
{
    public function __construct(
        private readonly DatabaseManager $database,
        private readonly PollOptionLabelRules $optionLabels,
    ) {}

    public function handle(Poll $poll, User $user, string $label): PollOption
    {
        return $this->database->transaction(function () use ($poll, $user, $label): PollOption {
            $lockedPoll = Poll::query()->whereKey($poll->id)->lockForUpdate()->firstOrFail();
            if ($lockedPoll->isClosed()) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete está encerrada.']);
            }
            if (! $lockedPoll->allow_new_options) {
                throw ValidationException::withMessages(['poll' => 'Esta enquete não permite novas opções.']);
            }
            if ($this->optionLabels->normalize($label) === '') {
                throw ValidationException::withMessages(['label' => 'Informe uma opção.']);
            }

            $normalizedLabel = $this->optionLabels->normalize($label);
            $similar = $lockedPoll->options()->get(['id', 'label', 'hidden_at'])->first(
                fn (PollOption $option): bool => $this->optionLabels->normalize($option->label) === $normalizedLabel,
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
}
