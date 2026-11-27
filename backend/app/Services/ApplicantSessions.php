<?php

namespace App\Services;

use App\Enums\ApplicantStatus;
use App\Models\Applicant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie as Cookies;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ApplicantSessions
{
    public const COOKIE = 'gdev_applicant';

    // Invoked inside the OTP verification transaction and email lock.
    public function issue(Applicant $applicant): string
    {
        if (! in_array($applicant->status, [ApplicantStatus::Draft, ApplicantStatus::Pending], true)) {
            throw new ConflictHttpException('Candidatura indisponível.');
        }
        $token = bin2hex(random_bytes(32));
        DB::table('applicant_sessions')->updateOrInsert(['applicant_id' => $applicant->id], [
            'token_hash' => $this->hash($token),
            'verified_at' => now(),
            'last_seen_at' => now(),
            'expires_at' => now()->addDays($this->absoluteDays()),
        ]);

        return $token;
    }

    public function current(Request $request): ?Applicant
    {
        $hash = $this->requestHash($request);
        if ($hash === null) {
            return null;
        }

        return DB::transaction(function () use ($hash): ?Applicant {
            $session = DB::table('applicant_sessions')->where('token_hash', $hash)->lockForUpdate()->first();
            if ($session === null) {
                return null;
            }
            if ($session->expires_at <= now()->toDateTimeString()
                || $session->verified_at <= now()->subDays($this->absoluteDays())->toDateTimeString()
                || $session->last_seen_at <= now()->subDays($this->idleDays())->toDateTimeString()) {
                DB::table('applicant_sessions')->where('token_hash', $hash)->delete();

                return null;
            }
            $applicant = Applicant::query()->find($session->applicant_id);
            if ($applicant === null || $applicant->email_verified_at === null || $applicant->status === ApplicantStatus::Unverified) {
                return null;
            }
            DB::table('applicant_sessions')->where('token_hash', $hash)->update(['last_seen_at' => now()]);

            return $applicant;
        }, 3);
    }

    public function revoke(Request $request): void
    {
        if ($hash = $this->requestHash($request)) {
            DB::table('applicant_sessions')->where('token_hash', $hash)->delete();
        }
    }

    public function clear(Request $request): void
    {
        $this->revoke($request);
        Cookies::queue($this->cookie('', true));
    }

    public function cookie(string $token, bool $expired = false): Cookie
    {
        return Cookie::create(
            self::COOKIE,
            $token,
            $expired ? now()->subDay() : now()->addDays($this->absoluteDays()),
            config('session.path', '/'),
            config('session.domain'),
            true,
            true,
            false,
            Cookie::SAMESITE_LAX,
        );
    }

    private function requestHash(Request $request): ?string
    {
        $token = $request->cookie(self::COOKIE);

        return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token) ? $this->hash($token) : null;
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    private function idleDays(): int
    {
        return max(1, (int) config('applications.session.idle_days'));
    }

    private function absoluteDays(): int
    {
        return max(1, (int) config('applications.session.absolute_days'));
    }
}
