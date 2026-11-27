<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserNote;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
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

        return $this->noteResponse($member, $this->snapshot($authorId, $member->id));
    }

    public function update(Request $request, string $member): JsonResponse
    {
        $authorId = $this->authorId($request);
        $member = User::query()->findOrFail($member);

        $validated = $request->validate([
            'content' => ['present', 'nullable', 'string', 'max:10000'],
            'expected_version' => ['required', 'integer:strict', 'min:0', 'max:9007199254740990'],
            'version' => ['missing'],
            'id' => ['missing'],
            'author_id' => ['missing'],
            'user_id' => ['missing'],
        ]);
        $content = $validated['content'] ?? '';

        $expected = $validated['expected_version'];

        try {
            if ($expected === 0) {
                try {
                    UserNote::query()->create([
                        'author_id' => $authorId,
                        'user_id' => $member->id,
                        'content' => $content,
                    ]);
                    $written = true;
                } catch (UniqueConstraintViolationException $error) {
                    // Only a collision on the scoped pair is a version conflict.
                    if (! UserNote::query()->where('author_id', $authorId)->where('user_id', $member->id)->exists()) {
                        throw $error;
                    }
                    $written = false;
                }
            } else {
                $written = UserNote::query()
                    ->where('author_id', $authorId)
                    ->where('user_id', $member->id)
                    ->where('version', $expected)
                    ->update(['content' => $content, 'version' => $expected + 1]) === 1;
            }

            if (! $written) {
                return response()->json([
                    'reason' => 'note_version_conflict',
                    'message' => 'A anotação foi alterada em outra gravação.',
                    'note' => $this->noteData($member, $this->snapshot($authorId, $member->id)),
                ], 409)->header('Cache-Control', 'private, no-store');
            }
        } catch (QueryException) {
            // Never report SQL bindings containing the private note.
            abort(500, 'Não foi possível salvar a anotação.');
        }

        return $this->noteResponse($member, ['content' => $content, 'version' => $expected + 1]);
    }

    private function snapshot(string $authorId, string $memberId): array
    {
        $note = UserNote::query()->where('author_id', $authorId)->where('user_id', $memberId)->first(['content', 'version']);

        return ['content' => $note?->content ?? '', 'version' => $note?->version ?? 0];
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

    private function noteData(User $member, array $snapshot): array
    {
        return ['member' => ['id' => $member->id, 'name' => $member->name], ...$snapshot];
    }

    private function noteResponse(User $member, array $snapshot): JsonResponse
    {
        return response()->json($this->noteData($member, $snapshot))->header('Cache-Control', 'private, no-store');
    }
}
