<?php

namespace App\Services;

use App\Models\Poll;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class PollSlugger
{
    public const MAX_LENGTH = 120;

    public function base(string $question): string
    {
        $slug = Str::slug(Str::ascii($question));

        return Str::limit($slug, self::MAX_LENGTH, '');
    }

    public function uniqueFor(Poll $poll, ?Carbon $now = null): string
    {
        $now ??= now();
        $base = $this->base($poll->question);
        $dateTimeSuffix = $now->format('Y-m-d-H-i');
        $candidates = [
            $base,
            $this->withSuffix($base, $now->format('Y-m')),
            $this->withSuffix($base, $now->format('Y-m-d')),
            $this->withSuffix($base, $dateTimeSuffix),
        ];

        foreach ($candidates as $candidate) {
            if (! Poll::query()->where('slug', $candidate)->exists()) {
                return $candidate;
            }
        }

        for ($counter = 0; ; $counter++) {
            $candidate = $this->withSuffix($base, $dateTimeSuffix.'-'.str_pad((string) $counter, 2, '0', STR_PAD_LEFT));
            if (! Poll::query()->where('slug', $candidate)->exists()) {
                return $candidate;
            }
        }
    }

    private function withSuffix(string $base, string $suffix): string
    {
        $available = self::MAX_LENGTH - strlen($suffix) - 1;

        return trim(substr($base, 0, max(1, $available)), '-').'-'.$suffix;
    }
}
