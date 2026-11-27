<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserNote;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNoteController
{
    public function index(): JsonResponse
    {
        return response()->json([
            'members' => User::query()->orderBy('name')->orderBy('id')->get(['id', 'name']),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function show(string $member): JsonResponse
    {
        $member = User::query()->findOrFail($member);

        return $this->noteResponse($member, UserNote::query()->find($member->id)?->content ?? '');
    }

    public function update(Request $request, string $member): JsonResponse
    {
        $member = User::query()->findOrFail($member);

        $validated = $request->validate(['content' => ['present', 'nullable', 'string', 'max:10000']]);
        $content = $validated['content'] ?? '';

        try {
            UserNote::query()->upsert(
                [['user_id' => $member->id, 'content' => $content]],
                ['user_id'],
                ['content'],
            );
        } catch (QueryException) {
            // Never report SQL bindings containing the private note.
            abort(500, 'Não foi possível salvar a anotação.');
        }

        return $this->noteResponse($member, $content);
    }

    private function noteResponse(User $member, string $content): JsonResponse
    {
        return response()->json([
            'member' => ['id' => $member->id, 'name' => $member->name],
            'content' => $content,
        ])->header('Cache-Control', 'private, no-store');
    }
}
