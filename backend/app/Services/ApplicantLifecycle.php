<?php

namespace App\Services;

use App\Enums\ApplicantStatus;
use App\Enums\MemberType;
use App\Enums\OtpPurpose;
use App\Enums\OtpRequestStatus;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ApplicantLifecycle
{
    // A rejected record is returned only as the subject of an OTP challenge.
    // The caller must not disclose this distinction before proof of possession.
    public function start(string $email): Applicant|User
    {
        $email = Applicant::normalizeEmail($email);

        return $this->withEmailLock($email, function () use ($email): Applicant|User {
            try {
                return DB::transaction(fn () => $this->startLocked($email), 3);
            } catch (UniqueConstraintViolationException $exception) {
                return $this->member($email) ?? $this->open($email) ?? throw $exception;
            }
        });
    }

    // Caller holds the normalized email lock and database transaction.
    public function startLocked(string $email): Applicant|User
    {
        return $this->member($email)
            ?? $this->open($email)
            ?? Applicant::query()->where('email', $email)
                ->where('status', ApplicantStatus::Rejected)
                ->latest('reviewed_at')->orderByDesc('id')->first()
            ?? $this->createUnverified($email);
    }

    // Called only with a registration OTP already consumed by the verifier.
    // Registration verification uses confirmEmailLocked in the same transaction.
    public function confirmEmail(OtpRequest $proof): Applicant|User
    {
        if ($proof->email === null) {
            throw new ConflictHttpException('Invalid registration proof.');
        }

        $email = Applicant::normalizeEmail($proof->email);

        return $this->withEmailLock($email, fn () => DB::transaction(fn () => $this->confirmEmailLocked($proof), 3));
    }

    // Caller holds the normalized email lock and database transaction.
    public function confirmEmailLocked(OtpRequest $proof): Applicant|User
    {
        $email = Applicant::normalizeEmail((string) $proof->email);
        $otp = OtpRequest::query()->lockForUpdate()->findOrFail($proof->id);
        if ($otp->purpose !== OtpPurpose::Registration || $otp->status !== OtpRequestStatus::Used
            || $otp->accepted_at === null || $otp->email !== $email) {
            throw new ConflictHttpException('Invalid registration proof.');
        }

        if ($member = $this->member($email)) {
            return $member;
        }

        $subject = Applicant::query()->lockForUpdate()->find($otp->applicant_id);
        if ($subject === null || $subject->email !== $email) {
            throw new ConflictHttpException('Invalid registration subject.');
        }

        $eventKey = 'otp-verified:'.$otp->id;
        if (DB::table('applicant_events')->where('event_key', $eventKey)->exists()) {
            throw new ConflictHttpException('Registration proof already consumed.');
        }

        if ($subject->status === ApplicantStatus::Rejected) {
            if ($subject->reviewed_at === null || $otp->created_at->lt($subject->reviewed_at)) {
                throw new ConflictHttpException('A new OTP is required after rejection.');
            }
            $applicant = $this->open($email) ?? $this->createUnverified($email);
            $this->event($subject, 'reapplication:'.$otp->id, 'reapplication');
            $otp->update(['applicant_id' => $applicant->id]);
        } elseif ($subject->status->isOpen()) {
            $applicant = $subject;
        } else {
            throw new ConflictHttpException('Application is no longer open.');
        }

        if ($applicant->status === ApplicantStatus::Unverified) {
            $applicant->forceFill([
                'status' => ApplicantStatus::Draft,
                'current_step' => 'identification',
                'email_verified_at' => now(),
                'revision' => $applicant->revision + 1,
            ])->save();
        }
        $this->event($applicant, $eventKey, 'email_verified', 'otp');

        return $applicant;
    }

    // Submission validation and the durable notification intent are mandatory
    // callbacks, implemented by the submission action (T017/T018).
    public function submit(Applicant $applicant, int $revision, Closure $validate, Closure $notificationIntent, ?Closure $guard = null): Applicant
    {
        return $this->mutate($applicant, function (Applicant $current) use ($revision, $validate, $notificationIntent, $guard): Applicant {
            if ($guard !== null) {
                $guard($current);
            }
            if ($current->status === ApplicantStatus::Pending) {
                return $current;
            }
            if ($current->status !== ApplicantStatus::Draft || $current->revision !== $revision
                || $current->email_verified_at === null || $this->member($current->email)) {
                throw new ConflictHttpException('Application cannot be submitted.');
            }

            $validate($current);
            $current->forceFill([
                'status' => ApplicantStatus::Pending,
                'submitted_at' => now(),
                'current_step' => 'submitted',
                'revision' => $current->revision + 1,
            ])->save();
            $this->event($current, 'status:pending', 'submitted');
            $notificationIntent($current);

            return $current;
        });
    }

    public function approve(Applicant $applicant, User $reviewer): User
    {
        return $this->mutate($applicant, function (Applicant $current) use ($reviewer): User {
            $actor = $this->admin($reviewer);
            $member = $this->member($current->email);
            if ($current->status === ApplicantStatus::Approved && $member?->applicant_id === $current->id) {
                return $member;
            }
            $this->requirePending($current);
            if ($member !== null || blank($current->first_name) || blank($current->last_name)) {
                throw new ConflictHttpException('Application cannot be approved.');
            }

            $member = new User([
                'name' => trim($current->first_name.' '.$current->last_name),
                'email' => $current->email,
                'member_type' => MemberType::MEMBER,
                'status' => User::STATUS_ACTIVE,
            ]);
            $member->applicant()->associate($current);
            try {
                $member->save();
            } catch (UniqueConstraintViolationException $exception) {
                throw new ConflictHttpException('Member already exists for this application or email.', $exception);
            }
            $this->decide($current, ApplicantStatus::Approved, $actor);

            return $member;
        });
    }

    public function reject(Applicant $applicant, User $reviewer): Applicant
    {
        return $this->mutate($applicant, function (Applicant $current) use ($reviewer): Applicant {
            $actor = $this->admin($reviewer);
            if ($current->status === ApplicantStatus::Rejected) {
                return $current;
            }
            $this->requirePending($current);
            $this->decide($current, ApplicantStatus::Rejected, $actor);

            return $current;
        });
    }

    private function mutate(Applicant $applicant, Closure $callback): mixed
    {
        return $this->withEmailLock($applicant->email, fn () => DB::transaction(function () use ($applicant, $callback): mixed {
            $current = Applicant::query()->lockForUpdate()->findOrFail($applicant->id);
            if ($current->email !== $applicant->email) {
                throw new ConflictHttpException('Application identity changed.');
            }

            return $callback($current);
        }, 3));
    }

    public function withEmailLock(string $email, Closure $callback): mixed
    {
        $key = hash_hmac('sha256', Applicant::normalizeEmail($email), (string) config('app.key'));

        return Cache::lock('applicant-email:'.$key, 60)->block(5, $callback);
    }

    private function member(string $email): ?User
    {
        return User::query()->whereRaw('LOWER(TRIM(email)) = ?', [$email])->first();
    }

    private function open(string $email): ?Applicant
    {
        return Applicant::query()->where('active_email', $email)->first();
    }

    private function createUnverified(string $email): Applicant
    {
        $applicant = Applicant::query()->create(['email' => $email])->refresh();
        $this->event($applicant, 'status:unverified', 'created', 'email');

        return $applicant;
    }

    private function admin(User $reviewer): User
    {
        $actor = User::query()->lockForUpdate()->find($reviewer->id);
        if ($actor?->status !== User::STATUS_ACTIVE || $actor->member_type !== MemberType::ADMIN) {
            throw new AccessDeniedHttpException('Administrator required.');
        }

        return $actor;
    }

    private function requirePending(Applicant $applicant): void
    {
        if ($applicant->status !== ApplicantStatus::Pending || $applicant->submitted_at === null) {
            throw new ConflictHttpException('Application is not pending.');
        }
    }

    private function decide(Applicant $applicant, ApplicantStatus $status, User $actor): void
    {
        $applicant->forceFill([
            'status' => $status,
            'reviewed_at' => now(),
            'reviewed_by' => $actor->id,
            'revision' => $applicant->revision + 1,
        ])->save();
        OtpRequest::query()->where('purpose', OtpPurpose::Registration)
            ->where('applicant_id', $applicant->id)->where('status', OtpRequestStatus::Pending)
            ->update(['status' => OtpRequestStatus::Locked]);
        $this->event($applicant, 'status:'.$status->value, $status->value, actor: $actor);
    }

    private function event(Applicant $applicant, string $key, string $type, ?string $step = null, ?User $actor = null): void
    {
        $applicant->events()->create([
            'event_key' => $key,
            'event_type' => $type,
            'step' => $step,
            'occurred_at' => now(),
            'actor_user_id' => $actor?->id,
        ]);
    }
}
