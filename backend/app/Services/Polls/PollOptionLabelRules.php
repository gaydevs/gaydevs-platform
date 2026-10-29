<?php

namespace App\Services\Polls;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PollOptionLabelRules
{
    public function assertUnique(array $labels, bool $allowNewOptions = false): void
    {
        $normalizedLabels = [];
        foreach ($labels as $index => $label) {
            $normalizedLabel = $this->normalize((string) $label);
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

    public function normalize(string $label): string
    {
        $ascii = Str::lower(Str::ascii($label));
        $withoutSpecialCharacters = preg_replace('/[^a-z0-9\s]/', '', $ascii) ?? '';

        return trim(preg_replace('/\s+/', ' ', $withoutSpecialCharacters) ?? '');
    }
}
