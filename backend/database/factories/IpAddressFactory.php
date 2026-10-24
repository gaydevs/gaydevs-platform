<?php

namespace Database\Factories;

use App\Models\IpAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<IpAddress> */
class IpAddressFactory extends Factory
{
    protected $model = IpAddress::class;

    public function definition(): array
    {
        return [
            'ip' => fake()->ipv4(),
            'first_observed_at' => now(),
            'last_observed_at' => now(),
        ];
    }
}
