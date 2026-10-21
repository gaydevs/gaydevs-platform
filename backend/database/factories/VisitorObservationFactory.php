<?php

namespace Database\Factories;

use App\Models\IpGeolocation;
use App\Models\Visit;
use App\Models\VisitorObservation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<VisitorObservation> */
class VisitorObservationFactory extends Factory
{
    protected $model = VisitorObservation::class;

    public function definition(): array
    {
        return [
            'request_id' => (string) Str::uuid7(),
            'visit_id' => Visit::factory(),
            'ip_geolocation_id' => IpGeolocation::factory(),
            'user_agent' => fake()->userAgent(),
            'browser' => 'Other',
            'os' => 'Other',
            'device_type' => 'desktop',
            'language' => 'pt-BR',
            'method' => 'GET',
            'path' => '/ping',
            'observed_at' => now(),
        ];
    }
}
