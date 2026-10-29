<?php

namespace App\Actions\Polls;

use App\Models\Poll;
use App\Models\User;
use App\Services\Polls\PollOptionLabelRules;
use App\Services\PollSlugger;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreatePoll
{
    public function __construct(
        private readonly PollSlugger $slugger,
        private readonly PollOptionLabelRules $optionLabels,
        private readonly DatabaseManager $database,
    ) {}

    public function handle(User $user, array $data): Poll
    {
        $attempt = 0;
        while (true) {
            try {
                return $this->database->transaction(function () use ($user, $data): Poll {
                    $allowNewOptions = (bool) ($data['allow_new_options'] ?? false);
                    $this->optionLabels->assertUnique($data['options'], $allowNewOptions);
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

    private function isSlugCollision(QueryException $exception): bool
    {
        $message = Str::lower($exception->getMessage());

        return Str::contains($message, 'slug') && Str::contains($message, 'unique');
    }
}
