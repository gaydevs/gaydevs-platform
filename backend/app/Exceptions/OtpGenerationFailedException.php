<?php

namespace App\Exceptions;

class OtpGenerationFailedException extends OperationalException
{
    public function __construct(
        private readonly string $userId,
        private readonly int $visitorObservationId,
    ) {
        parent::__construct('Não foi possível gerar um OTP inédito.');
    }

    protected function event(): string
    {
        return 'otp_generation_failed';
    }

    protected function context(): array
    {
        return [
            'user_id' => $this->userId,
            'visitor_observation_id' => $this->visitorObservationId,
        ];
    }
}
