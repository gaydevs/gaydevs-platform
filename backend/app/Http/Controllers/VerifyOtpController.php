<?php

namespace App\Http\Controllers;

use App\Actions\VerifyLoginOtp;
use App\Enums\OtpAttemptResult;
use App\Exceptions\MissingVisitorObservationException;
use App\Http\Requests\VerifyOtpRequest;
use App\Models\VisitorObservation;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class VerifyOtpController extends Controller
{
    public function __invoke(VerifyOtpRequest $request, VerifyLoginOtp $verifyLoginOtp): Response
    {
        $observation = $request->attributes->get('visitor_observation');
        if (! $observation instanceof VisitorObservation) {
            throw new MissingVisitorObservationException;
        }

        abort_unless($request->hasSession(), Response::HTTP_UNPROCESSABLE_ENTITY);

        $verification = $verifyLoginOtp->handle(
            $request->validated('otp_request_id'),
            $request->validated('code'),
            $request->ip(),
            $observation,
            $request,
        );

        return match ($verification->result) {
            OtpAttemptResult::Accepted => response()->noContent(),
            OtpAttemptResult::Superseded => response()->json([
                'message' => 'Este código foi substituído por um código mais novo.',
                'reason' => 'otp_superseded',
            ], Response::HTTP_UNPROCESSABLE_ENTITY),
            OtpAttemptResult::RateLimited => response()->json([
                'message' => 'Muitas tentativas. Tente novamente mais tarde.',
            ], Response::HTTP_TOO_MANY_REQUESTS),
            default => $this->genericFailure(),
        };
    }

    private function genericFailure(): JsonResponse
    {
        return response()->json([
            'message' => 'Código inválido ou expirado.',
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
