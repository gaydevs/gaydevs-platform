<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserNote;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserNoteController
{
    public function index(): JsonResponse
    {
        return response()->json([
            'members' => User::query()
                ->leftJoin('user_notes', 'users.id', '=', 'user_notes.user_id')
                ->orderBy('users.name')->orderBy('users.id')
                ->get(['users.id', 'users.name', 'user_notes.content'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'preview' => $this->preview($user->content ?? ''),
                ]),
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

    private function preview(string $content): string
    {
        $html = Str::markdown($content, ['html_input' => 'strip', 'allow_unsafe_links' => false]);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return Str::limit(Str::squish($text), 157, '…');
    }

    private function noteResponse(User $member, string $content): JsonResponse
    {
        return response()->json([
            'member' => ['id' => $member->id, 'name' => $member->name],
            'content' => $content,
        ])->header('Cache-Control', 'private, no-store');
    }
}
