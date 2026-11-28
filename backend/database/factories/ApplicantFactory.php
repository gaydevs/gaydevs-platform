<?php

namespace Database\Factories;

use App\Enums\ApplicantStatus;
use App\Models\Applicant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Applicant> */
class ApplicantFactory extends Factory
{
    protected $model = Applicant::class;

    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'status' => ApplicantStatus::Unverified,
            'current_step' => 'email',
        ];
    }

    public function draft(): static
    {
        return $this->state(fn (): array => [
            'status' => ApplicantStatus::Draft,
            'current_step' => 'identification',
            'email_verified_at' => now(),
        ]);
    }

    public function rejected(): static
    {
        return $this->draft()->state(fn (): array => [
            'status' => ApplicantStatus::Rejected,
            'submitted_at' => now(),
            'reviewed_at' => now(),
        ]);
    }
}
