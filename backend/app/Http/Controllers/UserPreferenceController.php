<?php

namespace App\Http\Controllers;

use App\Http\Requests\DismissPollSuggestionRequest;
use App\Http\Requests\SnoozePollSuggestionsRequest;
use App\Models\User;
use App\Services\UserPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserPreferenceController extends Controller
{
    public function __construct(private readonly UserPreferenceService $preferences) {}

    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['preferences' => $this->preferences->all($user)]);
    }

    public function snoozePollSuggestions(SnoozePollSuggestionsRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'preferences' => $this->preferences->snoozePollSuggestions($user, (int) ($request->validated('hours') ?? 24)),
        ]);
    }

    public function dismissPollSuggestion(DismissPollSuggestionRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'preferences' => $this->preferences->dismissPollSuggestion($user, $request->validated('poll_id')),
        ]);
    }
}
