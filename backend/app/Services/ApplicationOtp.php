<?php

namespace App\Services;

use App\Data\IssuedOtp;
use App\Enums\OtpAttemptResult;
use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Mail\ApplicationOtpMail;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class ApplicationOtp
{
    public function __construct(
        private ApplicantLifecycle $lifecycle,
        private OtpPrimitives $otp,
        private ApplicationRateLimiter $limits,
        private ApplicationTurnstile $turnstile,
        private ApplicationAvailability $availability,
        private EmailSender $emails,
    ) {}

    public function issue(string $email, string $token, ?string $ip, VisitorObservation $observation): OtpRequest
    {
        $this->availability->ensure();
        $email = Applicant::normalizeEmail($email);
        $this->turnstile->verify($token, $ip);
        $this->limits->sendOtp($email);
        $this->limits->mail();

        $issued = $this->lifecycle->withEmailLock($email, fn () => DB::transaction(function () use ($email, $observation): IssuedOtp {
            $subject = $this->lifecycle->startLocked($email);
            $requests = OtpRequest::query()->where('purpose', OtpPurpose::Registration)->where('email', $email);
            $code = $this->otp->generate($requests);
            $request = $this->otp->create([
                'purpose' => OtpPurpose::Registration,
                'email' => $email,
                'applicant_id' => $subject instanceof Applicant ? $subject->id : null,
                'user_id' => $subject instanceof User ? $subject->id : null,
            ], $observation, $code);
            $this->otp->supersede($requests, $request);

            return new IssuedOtp($request, $code, $email);
        }, 3));

        try {
            $this->emails->sendReserved($email, new ApplicationOtpMail($issued->code));
        } catch (Throwable) {
            throw new HttpException(503, 'Não foi possível enviar o código.');
        }

        return $issued->request;
    }

    public function verify(string $id, string $code, ?string $ip, VisitorObservation $observation, \Closure $onVerified): Applicant|User|null
    {
        $this->availability->ensure();
        $initial = OtpRequest::query()->where('purpose', OtpPurpose::Registration)->find($id);
        if ($initial === null || $initial->email === null) {
            return null;
        }

        return $this->lifecycle->withEmailLock($initial->email, fn () => DB::transaction(function () use ($id, $code, $observation, $onVerified): Applicant|User|null {
            $request = OtpRequest::query()->where('purpose', OtpPurpose::Registration)->lockForUpdate()->findOrFail($id);
            if ($request->status !== OtpRequestStatus::Pending) {
                $this->otp->record($request, $observation, match ($request->status) {
                    OtpRequestStatus::Used => OtpAttemptResult::AlreadyUsed,
                    OtpRequestStatus::Superseded => OtpAttemptResult::Superseded,
                    OtpRequestStatus::Locked => OtpAttemptResult::Locked,
                    default => OtpAttemptResult::Expired,
                });

                return null;
            }
            if ($this->otp->expire($request)) {
                $this->otp->record($request, $observation, OtpAttemptResult::Expired);

                return null;
            }
            if (! $request->matchesCode($code)) {
                $result = $this->otp->fail($request, (int) config('applications.limits.attempts'));
                $this->otp->record($request, $observation, $result);

                return null;
            }

            try {
                return DB::transaction(function () use ($request, $observation, $onVerified): Applicant|User {
                    $this->otp->accept($request);
                    $subject = $this->lifecycle->confirmEmailLocked($request);
                    $this->otp->record($request, $observation, OtpAttemptResult::Accepted);
                    $onVerified($subject);

                    return $subject;
                });
            } catch (ConflictHttpException) {
                $request->refresh()->update(['status' => OtpRequestStatus::Locked]);
                $this->otp->record($request, $observation, OtpAttemptResult::Locked);

                return null;
            }
        }, 3));
    }
}
