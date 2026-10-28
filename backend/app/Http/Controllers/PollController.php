<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreatePollOptionRequest;
use App\Http\Requests\CreatePollRequest;
use App\Http\Requests\SubmitPollResponseRequest;
use App\Models\PollOption;
use App\Models\User;
use App\Services\PollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PollController extends Controller
{
    public function __construct(private readonly PollService $polls) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'cursor' => ['nullable', 'string'],
            'since' => ['nullable', 'date'],
        ]);

        return response()->json($this->polls->listPayloads(
            (int) ($validated['limit'] ?? 3),
            $validated['cursor'] ?? null,
            isset($validated['since']) ? Carbon::parse($validated['since']) : null,
        ));
    }

    public function store(CreatePollRequest $request): JsonResponse
    {
        /** @var User $user */
        $poll = $this->polls->create($request->user(), $request->validated());

        return response()->json(['poll' => $this->polls->payload($this->polls->resolve($poll->slug))], 201);
    }

    public function close(Request $request, string $identifier): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);
        /** @var User $user */
        $user = $request->user();
        $closedPoll = $this->polls->close($poll, $user);

        return response()->json(['poll' => $this->polls->payload($this->polls->resolve($closedPoll->slug))]);
    }

    public function show(string $identifier): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);

        return response()->json(['poll' => $this->polls->payload($poll)]);
    }

    public function audit(string $identifier): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);

        return response()->json(['audit' => $this->polls->auditPayload($poll)]);
    }

    public function submit(SubmitPollResponseRequest $request, string $identifier): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);
        /** @var User $user */
        $user = $request->user();
        $this->polls->submit($poll, $user, $request->validated());

        return response()->json($this->polls->responsePayload($this->polls->resolve($poll->slug), $user, ! empty($request->validated('added_options'))));
    }

    public function addOption(CreatePollOptionRequest $request, string $identifier): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);
        /** @var User $user */
        $option = $this->polls->addOption($poll, $user = $request->user(), $request->validated('label'));

        return response()->json(['option' => ['id' => $option->id, 'label' => $option->label]], 201);
    }

    public function removeOption(Request $request, string $identifier, string $option): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);
        $pollOption = PollOption::query()->findOrFail($option);
        /** @var User $user */
        $this->polls->removeOption($poll, $pollOption, $request->user());

        return response()->json([], 204);
    }

    public function hideOption(Request $request, string $identifier, string $option): JsonResponse
    {
        $poll = $this->polls->resolve($identifier);
        $pollOption = PollOption::query()->findOrFail($option);
        /** @var User $user */
        $this->polls->hideOption($poll, $pollOption, $user = $request->user(), true);

        return response()->json(['poll' => $this->polls->payload($this->polls->resolve($poll->slug))]);
    }
}
