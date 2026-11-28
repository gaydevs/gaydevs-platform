<?php

namespace Database\Factories;

use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/** @extends Factory<OtpRequest> */
class OtpRequestFactory extends Factory
{
    protected $model = OtpRequest::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'purpose' => OtpPurpose::Login,
            'email' => fn (array $attributes): string => Applicant::normalizeEmail(User::query()->findOrFail($attributes['user_id'])->email),
            'visitor_observation_id' => VisitorObservation::factory(),
            'code_hash' => Hash::make('123456'),
            'status' => OtpRequestStatus::Pending,
            'failed_attempts' => 0,
            'expires_at' => now()->addMinutes(10),
        ];
    }

    public function forApplicant(Applicant $applicant): static
    {
        return $this->state(fn (): array => [
            'user_id' => null,
            'applicant_id' => $applicant->id,
            'purpose' => OtpPurpose::Registration,
            'email' => $applicant->email,
        ]);
    }

    public function supersededBy(OtpRequest $replacement): static
    {
        return $this->state(fn (): array => [
            'user_id' => $replacement->user_id,
            'status' => OtpRequestStatus::Superseded,
            'superseded_at' => now(),
            'superseded_by_id' => $replacement->id,
        ]);
    }
}
