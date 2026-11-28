<?php

namespace App\Services;

use App\Enums\OtpAttemptResult;
use App\Enums\OtpRequestStatus;
use App\Models\OtpAttempt;
use App\Models\OtpRequest;
use App\Models\VisitorObservation;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class OtpPrimitives
{
    public function generate(Builder $subject): string
    {
        $hashes = (clone $subject)->pluck('code_hash');
        $digits = (int) config('passwordless.otp.digits');
        $largest = (10 ** $digits) - 1;
        for ($attempt = 0; $attempt < (int) config('passwordless.otp.max_generation_attempts'); $attempt++) {
            $code = str_pad((string) random_int(0, $largest), $digits, '0', STR_PAD_LEFT);
            if ($hashes->doesntContain(fn (string $hash): bool => Hash::check($code, $hash))) {
                return $code;
            }
        }

        throw new RuntimeException('OTP generation exhausted.');
    }

    public function create(array $identity, VisitorObservation $observation, string $code): OtpRequest
    {
        return OtpRequest::query()->create([
            ...$identity,
            'visitor_observation_id' => $observation->id,
            'code_hash' => Hash::make($code),
            'status' => OtpRequestStatus::Pending,
            'failed_attempts' => 0,
            'expires_at' => now()->addMinutes((int) config('passwordless.otp.expires_in_minutes')),
        ]);
    }

    public function expire(OtpRequest $otp): bool
    {
        if ($otp->status !== OtpRequestStatus::Expired && ! $otp->expires_at->isPast()) {
            return false;
        }
        if ($otp->status !== OtpRequestStatus::Expired) {
            $otp->update(['status' => OtpRequestStatus::Expired]);
        }

        return true;
    }

    public function supersede(Builder $subject, OtpRequest $replacement): void
    {
        (clone $subject)->where('status', OtpRequestStatus::Pending)->whereKeyNot($replacement->id)->update([
            'status' => OtpRequestStatus::Superseded,
            'superseded_at' => now(),
            'superseded_by_id' => $replacement->id,
            'updated_at' => now(),
        ]);
    }

    public function accept(OtpRequest $otp, ?CarbonInterface $at = null): void
    {
        $otp->update(['status' => OtpRequestStatus::Used, 'accepted_at' => $at ?? now()]);
    }

    public function fail(OtpRequest $otp, int $maximum): OtpAttemptResult
    {
        $attempts = $otp->failed_attempts + 1;
        $locked = $attempts >= $maximum;
        $otp->update([
            'failed_attempts' => $attempts,
            'status' => $locked ? OtpRequestStatus::Locked : OtpRequestStatus::Pending,
        ]);

        return $locked ? OtpAttemptResult::Locked : OtpAttemptResult::InvalidCode;
    }

    public function record(OtpRequest $otp, VisitorObservation $observation, OtpAttemptResult $result, ?OtpRequest $matched = null, bool $authenticated = false): void
    {
        OtpAttempt::query()->create([
            'otp_request_id' => $otp->id,
            'matched_otp_request_id' => $matched?->id,
            'visitor_observation_id' => $observation->id,
            'authenticated_user_id' => $authenticated ? $otp->user_id : null,
            'result' => $result,
            'attempted_at' => now(),
        ]);
    }
}
