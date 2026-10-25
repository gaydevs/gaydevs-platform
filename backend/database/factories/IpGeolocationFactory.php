<?php

namespace Database\Factories;

use App\Models\IpAddress;
use App\Models\IpGeolocation;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<IpGeolocation> */
class IpGeolocationFactory extends Factory
{
    protected $model = IpGeolocation::class;

    public function definition(): array
    {
        return [
            'ip_address_id' => IpAddress::factory(),
            'geo_status' => 'unavailable',
            'resolved_at' => now(),
            'last_verified_at' => now(),
            'valid_from' => now(),
        ];
    }
}
