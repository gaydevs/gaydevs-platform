<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\UserPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurrentSessionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'member_type' => $user->member_type,
                ...($user->applicant_id !== null ? [
                    'onboarding_eligible' => true,
                    'onboarding_required' => ! app(UserPreferenceService::class)->onboardingSeen($user),
                ] : []),
            ],
        ]);
    }
}
