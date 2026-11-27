<?php

namespace App\Services;

use App\Data\IssuedOtp;
use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Exceptions\OtpGenerationFailedException;
use App\Exceptions\UserNotActiveException;
use App\Exceptions\UserNotFoundException;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class OtpIssuer
{
    private const TRANSACTION_ATTEMPTS = 3;

    public function __construct(private OtpPrimitives $otp) {}

    public function issue(User $user, VisitorObservation $observation): IssuedOtp
    {
        return DB::transaction(function () use ($user, $observation): IssuedOtp {
            $lockedUser = User::query()->lockForUpdate()->find($user->id);
            if ($lockedUser === null) {
                throw new UserNotFoundException;
            }
            if ($lockedUser->status !== User::STATUS_ACTIVE) {
                throw new UserNotActiveException;
            }

            $subject = OtpRequest::query()->where('user_id', $lockedUser->id)->where('purpose', OtpPurpose::Login);
            try {
                $code = $this->otp->generate($subject);
            } catch (\RuntimeException) {
                throw new OtpGenerationFailedException($lockedUser->id, $observation->id);
            }

            $request = OtpRequest::query()->create([
                'user_id' => $lockedUser->id,
                'purpose' => OtpPurpose::Login,
                'email' => Applicant::normalizeEmail($lockedUser->email),
                'visitor_observation_id' => $observation->id,
                'code_hash' => Hash::make($code),
                'status' => OtpRequestStatus::Pending,
                'failed_attempts' => 0,
                'expires_at' => now()->addMinutes(
                    (int) config('passwordless.otp.expires_in_minutes'),
                ),
            ]);

            $this->otp->supersede($subject, $request);

            return new IssuedOtp($request, $code, $lockedUser->email);
        }, self::TRANSACTION_ATTEMPTS);
    }
}
