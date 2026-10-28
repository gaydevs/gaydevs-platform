<?php

namespace Database\Factories;

use App\Enums\MemberType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'status' => User::STATUS_ACTIVE,
            'member_type' => MemberType::MEMBER,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['status' => User::STATUS_INACTIVE]);
    }
}
