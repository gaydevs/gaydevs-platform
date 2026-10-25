<?php

namespace App\Http\Controllers;

use App\Actions\RequestLoginOtp;
use App\Exceptions\MissingVisitorObservationException;
use App\Http\Requests\RequestOtpRequest;
use App\Models\VisitorObservation;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class RequestOtpController extends Controller
{
    public function __invoke(RequestOtpRequest $request, RequestLoginOtp $requestLoginOtp): JsonResponse
    {
        $observation = $request->attributes->get('visitor_observation');
        if (! $observation instanceof VisitorObservation) {
            throw new MissingVisitorObservationException;
        }

        $otpRequest = $requestLoginOtp->handle(
            $request->validated('user_id'),
            $request->ip(),
            $observation,
        );

        return response()->json([
            'otp_request_id' => $otpRequest->id,
            'expires_at' => $otpRequest->expires_at->toIso8601String(),
        ], Response::HTTP_ACCEPTED);
    }
}
