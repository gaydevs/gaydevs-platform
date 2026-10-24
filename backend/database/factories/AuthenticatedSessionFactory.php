<?php

namespace Database\Factories;

use App\Models\AuthenticatedSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AuthenticatedSession> */
class AuthenticatedSessionFactory extends Factory
{
    protected $model = AuthenticatedSession::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'authenticated_at' => now(),
            'last_seen_at' => now(),
        ];
    }
}
