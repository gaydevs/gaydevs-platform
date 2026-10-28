<?php

namespace App\Http\Controllers;

use App\Actions\Polls\AddPollOption;
use App\Actions\Polls\ClosePoll;
use App\Actions\Polls\CreatePoll;
use App\Actions\Polls\HidePollOption;
use App\Actions\Polls\SubmitPollResponse;
use App\Http\Requests\CreatePollOptionRequest;
use App\Http\Requests\CreatePollRequest;
use App\Http\Requests\SubmitPollResponseRequest;
use App\Models\PollOption;
use App\Models\User;
use App\Services\Polls\PollAuditPayloadBuilder;
use App\Services\Polls\PollPayloadBuilder;
use App\Services\Polls\PollReadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PollController extends Controller
{
    public function __construct(
        private readonly PollReadService $pollReads,
        private readonly PollPayloadBuilder $payloads,
        private readonly CreatePoll $createPoll,
        private readonly ClosePoll $closePoll,
        private readonly SubmitPollResponse $submitResponse,
        private readonly AddPollOption $addPollOption,
        private readonly HidePollOption $hidePollOption,
        private readonly PollAuditPayloadBuilder $auditPayloads,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'cursor' => ['nullable', 'string'],
            'since' => ['nullable', 'date'],
        ]);

        return response()->json($this->pollReads->listPayloads(
            (int) ($validated['limit'] ?? 3),
            $validated['cursor'] ?? null,
            isset($validated['since']) ? Carbon::parse($validated['since']) : null,
            $request->user(),
        ));
    }

    public function store(CreatePollRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->createPoll->handle($user, $request->validated());

        return response()->json(['poll' => $this->payloads->build($this->pollReads->resolve($poll->slug, $user), $user)], 201);
    }

    public function close(Request $request, string $identifier): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->pollReads->resolve($identifier, $user);
        $closedPoll = $this->closePoll->handle($poll, $user);

        return response()->json(['poll' => $this->payloads->build($this->pollReads->resolve($closedPoll->slug, $user), $user)]);
    }

    public function show(Request $request, string $identifier): JsonResponse
    {
        $viewer = $request->user('sanctum');
        $poll = $this->pollReads->resolve($identifier, $viewer);

        return response()->json(['poll' => $this->payloads->build($poll, $viewer)]);
    }

    public function audit(string $identifier): JsonResponse
    {
        $poll = $this->pollReads->resolve($identifier);

        return response()->json(['audit' => $this->auditPayloads->build($poll)]);
    }

    public function submit(SubmitPollResponseRequest $request, string $identifier): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->pollReads->resolve($identifier, $user);
        $this->submitResponse->handle($poll, $user, $request->validated());

        $updatedPoll = $this->pollReads->resolve($poll->slug, $user);

        return response()->json([
            'poll' => $this->payloads->build($updatedPoll, $user),
            'suggested_polls' => ! empty($request->validated('added_options')) ? $this->pollReads->suggestionsFor($updatedPoll, $user) : [],
        ]);
    }

    public function addOption(CreatePollOptionRequest $request, string $identifier): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->pollReads->resolve($identifier, $user);
        $option = $this->addPollOption->handle($poll, $user, $request->validated('label'));

        return response()->json(['option' => ['id' => $option->id, 'label' => $option->label]], 201);
    }

    public function removeOption(Request $request, string $identifier, string $option): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->pollReads->resolve($identifier, $user);
        $pollOption = PollOption::query()->findOrFail($option);
        $this->hidePollOption->handle($poll, $pollOption, $user);

        return response()->json([], 204);
    }

    public function hideOption(Request $request, string $identifier, string $option): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $poll = $this->pollReads->resolve($identifier, $user);
        $pollOption = PollOption::query()->findOrFail($option);
        $this->hidePollOption->handle($poll, $pollOption, $user, true);

        return response()->json(['poll' => $this->payloads->build($this->pollReads->resolve($poll->slug, $user), $user)]);
    }
}
