<?php

namespace App\Data;

use App\Enums\OtpAttemptResult;
use App\Models\AuthenticatedSession;
use App\Models\User;

readonly class OtpVerification
{
    public function __construct(
        public OtpAttemptResult $result,
        public ?User $user = null,
        public ?AuthenticatedSession $authenticatedSession = null,
    ) {}

    public function accepted(): bool
    {
        return $this->result === OtpAttemptResult::Accepted;
    }
}
