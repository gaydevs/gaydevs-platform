<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserNote;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserNoteController
{
    public function index(Request $request): JsonResponse
    {
        $authorId = $this->authorId($request);

        return response()->json([
            'members' => User::query()
                ->leftJoin('user_notes', function (JoinClause $join) use ($authorId): void {
                    $join->on('users.id', '=', 'user_notes.user_id')
                        ->where('user_notes.author_id', '=', $authorId);
                })
                ->orderBy('users.name')->orderBy('users.id')
                ->get(['users.id', 'users.name', 'user_notes.content'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'preview' => $this->preview($user->content ?? ''),
                ]),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $member): JsonResponse
    {
        $authorId = $this->authorId($request);
        $member = User::query()->findOrFail($member);

        return $this->noteResponse($member, UserNote::query()->where('author_id', $authorId)->where('user_id', $member->id)->value('content') ?? '');
    }

    public function update(Request $request, string $member): JsonResponse
    {
        $authorId = $this->authorId($request);
        $member = User::query()->findOrFail($member);

        $validated = $request->validate([
            'content' => ['present', 'nullable', 'string', 'max:10000'],
            'id' => ['missing'],
            'author_id' => ['missing'],
            'user_id' => ['missing'],
        ]);
        $content = $validated['content'] ?? '';

        try {
            UserNote::query()->upsert(
                [['id' => (string) Str::uuid7(), 'author_id' => $authorId, 'user_id' => $member->id, 'content' => $content]],
                ['author_id', 'user_id'],
                ['content'],
            );
        } catch (QueryException) {
            // Never report SQL bindings containing the private note.
            abort(500, 'Não foi possível salvar a anotação.');
        }

        return $this->noteResponse($member, $content);
    }

    private function authorId(Request $request): string
    {
        // The header is a session consistency check, never a source of ownership.
        $authorId = (string) $request->user()->getAuthIdentifier();
        abort_unless($request->header('X-Notes-Actor') === $authorId, 409, 'Sessão alterada. Recarregue a página.');

        return $authorId;
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
