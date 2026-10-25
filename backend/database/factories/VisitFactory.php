<?php

namespace Database\Factories;

use App\Models\Visit;
use App\Models\Visitor;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Visit> */
class VisitFactory extends Factory
{
    protected $model = Visit::class;

    public function definition(): array
    {
        return [
            'visitor_id' => Visitor::factory(),
            'started_at' => now(),
            'last_seen_at' => now(),
        ];
    }
}
