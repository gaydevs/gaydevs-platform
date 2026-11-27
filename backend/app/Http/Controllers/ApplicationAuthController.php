<?php

namespace App\Http\Controllers;

use App\Enums\ApplicantStatus;
use App\Exceptions\MissingVisitorObservationException;
use App\Models\Applicant;
use App\Models\User;
use App\Models\VisitorObservation;
use App\Services\ApplicantSessions;
use App\Services\ApplicationAvailability;
use App\Services\ApplicationOtp;
use App\Services\ApplicationRateLimiter;
use App\Services\AuthenticatedSessionManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ApplicationAuthController extends Controller
{
    public function issue(Request $request, ApplicationOtp $otp, ApplicationRateLimiter $limits): Response
    {
        $limits->request($request->ip());
        $data = $request->validate([
            'email' => ['required', 'string', 'max:255', 'email:rfc'],
            'turnstile_token' => ['required', 'string', 'max:2048'],
        ]);
        $challenge = $otp->issue($data['email'], $data['turnstile_token'], $request->ip(), $this->observation($request));

        return response()->json([
            'otp_request_id' => $challenge->id,
            'expires_at' => $challenge->expires_at->toIso8601String(),
        ], 202);
    }

    public function verify(Request $request, ApplicationOtp $otp, ApplicationRateLimiter $limits, ApplicantSessions $sessions, AuthenticatedSessionManager $members): Response
    {
        $limits->verify($request->ip());
        if ($request->bearerToken() !== null) {
            throw new HttpException(401, 'Sessão segura necessária.');
        }
        $data = $request->validate([
            'otp_request_id' => ['required', 'uuid'],
            'code' => ['required', 'digits:'.config('passwordless.otp.digits')],
        ]);

        $token = null;
        $subject = $otp->verify($data['otp_request_id'], (string) $data['code'], $request->ip(), $this->observation($request),
            function (Applicant|User $subject) use ($sessions, &$token): void {
                $token = $subject instanceof Applicant ? $sessions->issue($subject) : null;
            });
        if ($subject === null) {
            return response()->json(['message' => 'Código inválido ou expirado.'], 422);
        }
        $sessions->revoke($request);
        if ($subject instanceof User) {
            $response = response()->json(['status' => 'member', 'next' => 'login']);
            $response->headers->setCookie($sessions->cookie('', true));

            return $response;
        }

        if (Auth::guard('web')->check()) {
            $members->logout($request);
        } else {
            $request->session()->regenerate(true);
            $request->session()->regenerateToken();
        }
        Cookie::unqueue(ApplicantSessions::COOKIE, config('session.path', '/'));
        $response = response()->json(['status' => $subject->status->value]);
        $response->headers->setCookie($sessions->cookie($token));

        return $response;
    }

    public function session(Request $request, ApplicationAvailability $availability): Response
    {
        $applicant = $request->attributes->get('applicant');
        if (in_array($applicant->status, [ApplicantStatus::Approved, ApplicantStatus::Rejected], true)) {
            return response()->json(['status' => $applicant->status->value]);
        }

        $availability->ensure();

        return response()->json([
            'status' => $applicant->status->value,
            'current_step' => $applicant->current_step,
            'revision' => $applicant->revision,
            'whatsapp_url' => $availability->whatsapp(),
        ]);
    }

    public function logout(Request $request, ApplicantSessions $sessions): Response
    {
        $sessions->revoke($request);
        $response = response()->noContent();
        $response->headers->setCookie($sessions->cookie('', true));

        return $response;
    }

    private function observation(Request $request): VisitorObservation
    {
        $observation = $request->attributes->get('visitor_observation');
        if (! $observation instanceof VisitorObservation) {
            throw new MissingVisitorObservationException;
        }

        return $observation;
    }
}
