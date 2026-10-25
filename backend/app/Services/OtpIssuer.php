<?php

namespace App\Services;

use App\Data\IssuedOtp;
use App\Enums\OtpRequestStatus;
use App\Exceptions\OtpGenerationFailedException;
use App\Exceptions\UserNotActiveException;
use App\Exceptions\UserNotFoundException;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class OtpIssuer
{
    private const TRANSACTION_ATTEMPTS = 3;

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

            $code = $this->uniqueCode($lockedUser, $observation);

            $request = OtpRequest::query()->create([
                'user_id' => $lockedUser->id,
                'visitor_observation_id' => $observation->id,
                'code_hash' => Hash::make($code),
                'status' => OtpRequestStatus::Pending,
                'failed_attempts' => 0,
                'expires_at' => now()->addMinutes(
                    (int) config('passwordless.otp.expires_in_minutes'),
                ),
            ]);

            OtpRequest::query()
                ->where('user_id', $lockedUser->id)
                ->where('status', OtpRequestStatus::Pending->value)
                ->whereKeyNot($request->id)
                ->update([
                    'status' => OtpRequestStatus::Superseded->value,
                    'superseded_at' => now(),
                    'superseded_by_id' => $request->id,
                    'updated_at' => now(),
                ]);

            return new IssuedOtp($request, $code);
        }, self::TRANSACTION_ATTEMPTS);
    }

    private function uniqueCode(User $user, VisitorObservation $observation): string
    {
        $hashes = $user->otpRequests()->pluck('code_hash');
        $digits = (int) config('passwordless.otp.digits');
        $maxGenerationAttempts = (int) config('passwordless.otp.max_generation_attempts');
        $largestCode = (10 ** $digits) - 1;

        for ($attempt = 0; $attempt < $maxGenerationAttempts; $attempt++) {
            $code = str_pad((string) random_int(0, $largestCode), $digits, '0', STR_PAD_LEFT);
            if ($hashes->doesntContain(fn (string $hash): bool => Hash::check($code, $hash))) {
                return $code;
            }
        }

        throw new OtpGenerationFailedException($user->id, $observation->id);
    }
}
