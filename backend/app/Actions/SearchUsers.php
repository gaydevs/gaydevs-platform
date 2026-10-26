<?php

namespace App\Actions;

use App\Exceptions\RateLimitExceededException;
use App\Models\User;
use App\Services\EmailMasker;
use App\Services\NameMasker;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;

class SearchUsers
{
    public function __construct(
        private readonly EmailMasker $emails,
        private readonly NameMasker $names,
    ) {}

    /** @return Collection<int, array{id: string, name: string, email: string}> */
    public function handle(string $query, ?string $ip): Collection
    {
        $term = trim($query);
        if ($term === '') {
            return collect();
        }

        $rateKey = 'user-search:'.($ip ?? 'unknown');
        $maxAttempts = (int) config('passwordless.rate_limits.search_per_ip.max_attempts');
        if (RateLimiter::tooManyAttempts($rateKey, $maxAttempts)) {
            throw new RateLimitExceededException;
        }
        RateLimiter::hit(
            $rateKey,
            (int) config('passwordless.rate_limits.search_per_ip.decay_seconds'),
        );

        $likeTerm = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term);

        return User::query()
            ->where('status', User::STATUS_ACTIVE)
            ->where(function ($builder) use ($likeTerm): void {
                $builder
                    ->whereRaw("LOWER(name) LIKE LOWER(?) ESCAPE '!'", [$likeTerm.'%'])
                    ->orWhereRaw("LOWER(name) LIKE LOWER(?) ESCAPE '!'", ['% '.$likeTerm.'%'])
                    ->orWhereRaw("LOWER(email) LIKE LOWER(?) ESCAPE '!'", [$likeTerm.'%']);
            })
            ->orderByRaw(
                "CASE
                    WHEN LOWER(email) = LOWER(?) THEN 0
                    WHEN LOWER(name) = LOWER(?) THEN 1
                    WHEN LOWER(name) LIKE LOWER(?) ESCAPE '!' THEN 2
                    WHEN LOWER(name) LIKE LOWER(?) ESCAPE '!'
                        OR LOWER(name) LIKE LOWER(?) ESCAPE '!'
                    THEN 3
                    ELSE 4
                END",
                [
                    $term,
                    $term,
                    $likeTerm.'%',
                    '% '.$likeTerm,
                    '% '.$likeTerm.' %',
                ],
            )
            ->orderBy('name')
            ->limit((int) config('passwordless.search.max_results'))
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $this->names->mask($user->name, $term),
                'email' => $this->emails->mask($user->email, $term),
            ]);
    }
}
