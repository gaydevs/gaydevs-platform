<?php

namespace App\Actions;

use App\Data\OtpVerification;
use App\Models\VisitorObservation;
use App\Services\AuthenticatedSessionManager;
use App\Services\OtpVerifier;
use Illuminate\Http\Request;

class VerifyLoginOtp
{
    public function __construct(
        private readonly OtpVerifier $verifier,
        private readonly AuthenticatedSessionManager $sessions,
    ) {}

    public function handle(
        string $otpRequestId,
        string $code,
        ?string $ip,
        VisitorObservation $observation,
        Request $request,
    ): OtpVerification {
        $verification = $this->verifier->verify($otpRequestId, $code, $ip, $observation);

        if ($verification->accepted()) {
            $this->sessions->establish(
                $request,
                $verification->user,
                $verification->authenticatedSession,
            );
        }

        return $verification;
    }
}
