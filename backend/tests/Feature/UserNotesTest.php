<?php

use App\Enums\MemberType;
use App\Models\User;
use App\Models\UserNote;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function actAsNoteAuthor(User $author): array
{
    Sanctum::actingAs($author);

    return ['X-Notes-Actor' => $author->id];
}

test('admin lists members and maintains a single private note per author and member', function () {
    $admin = User::factory()->create(['name' => 'Zeta', 'member_type' => MemberType::ADMIN]);
    $member = User::factory()->create(['name' => 'Ana']);
    $headers = actAsNoteAuthor($admin);

    $this->getJson('/notes', $headers)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertExactJson(['members' => [
        ['id' => $member->id, 'name' => 'Ana', 'preview' => ''],
        ['id' => $admin->id, 'name' => 'Zeta', 'preview' => ''],
    ]]);
    $path = '/notes/'.$member->id;
    $this->getJson($path, $headers)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('content', '')->assertJsonPath('version', 0);
    $this->putJson($path, ['content' => '**Primeira**', 'expected_version' => 0], $headers)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('content', '**Primeira**')->assertJsonPath('version', 1);
    $note = UserNote::query()->sole();
    expect(Str::isUuid($note->id, 7))->toBeTrue();
    expect($note->author_id)->toBe($admin->id);
    expect($note->user_id)->toBe($member->id);
    $this->putJson($path, ['content' => '# Nova', 'expected_version' => 1], $headers)->assertOk();
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', '# Nova');
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Nova')->assertJsonMissingPath('members.0.content');
    $this->putJson($path, ['content' => '**'.str_repeat('x', 200).'**', 'expected_version' => 2], $headers)->assertOk();
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', str_repeat('x', 157).'…');
    expect(UserNote::query()->sole()->id)->toBe($note->id);
    $this->putJson($path, ['content' => '', 'expected_version' => 3], $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson($path, $headers)->assertJsonPath('content', '');
    $this->putJson($path, [], $headers)->assertUnprocessable();
    $this->putJson($path, ['content' => str_repeat('a', 10001), 'expected_version' => 4], $headers)->assertUnprocessable();
    $this->putJson('/notes/00000000-0000-0000-0000-000000000000', ['content' => 'x'], $headers)->assertNotFound();
});

test('two admins have independent notes and previews, including notes about one another', function () {
    $member = User::factory()->create(['name' => 'Ana']);
    $first = User::factory()->create(['name' => 'Beta', 'member_type' => MemberType::ADMIN]);
    $second = User::factory()->create(['name' => 'Gama', 'member_type' => MemberType::ADMIN]);
    $path = '/notes/'.$member->id;
    $headers = actAsNoteAuthor($first);
    $this->putJson($path, ['content' => 'Primeiro privado', 'expected_version' => 0], $headers)->assertOk();
    $this->putJson('/notes/'.$second->id, ['content' => 'Sobre o segundo admin', 'expected_version' => 0], $headers)->assertOk();

    $headers = actAsNoteAuthor($second);
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson('/notes/'.$second->id, $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson('/notes', $headers)->assertOk()->assertExactJson(['members' => [
        ['id' => $member->id, 'name' => 'Ana', 'preview' => ''],
        ['id' => $first->id, 'name' => 'Beta', 'preview' => ''],
        ['id' => $second->id, 'name' => 'Gama', 'preview' => ''],
    ]]);
    $this->putJson($path, ['content' => 'Segundo privado', 'expected_version' => 0], $headers)->assertOk();
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Segundo privado')
        ->assertJsonMissingPath('members.0.author_id')->assertJsonMissingPath('members.0.content');
    $this->putJson($path, ['content' => '', 'expected_version' => 1], $headers)->assertOk();
    expect(UserNote::query()->where('author_id', $second->id)->where('user_id', $member->id)->sole()->content)->toBe('');

    $headers = actAsNoteAuthor($first);
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', 'Primeiro privado');
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Primeiro privado')
        ->assertJsonPath('members.2.preview', 'Sobre o segundo admin');
    $this->putJson($path, ['content' => 'Atualizado', 'expected_version' => 1], $headers)->assertOk();
    expect(UserNote::query()->count())->toBe(3);
    expect(UserNote::query()->where('author_id', $second->id)->where('user_id', $member->id)->sole()->content)->toBe('');
});

test('missing or spoofed actor and ownership payload are rejected before reading or writing', function () {
    $first = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $second = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $note = UserNote::query()->create(['author_id' => $first->id, 'user_id' => $member->id, 'content' => 'privado']);
    $headers = actAsNoteAuthor($second);
    $path = '/notes/'.$member->id;
    foreach ([[], ['X-Notes-Actor' => $first->id]] as $invalid) {
        $this->getJson('/notes', $invalid)->assertConflict()->assertJsonMissingPath('members');
        $this->getJson($path, $invalid)->assertConflict()->assertJsonMissingPath('content');
        $this->putJson($path, ['content' => 'changed'], $invalid)->assertConflict()->assertJsonMissingPath('content');
    }
    foreach (['author_id' => $first->id, 'user_id' => $first->id, 'id' => $note->id] as $field => $value) {
        $this->putJson($path, ['content' => 'changed', 'expected_version' => 0, $field => $value], $headers)->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson($path, ['content' => 'changed', 'expected_version' => 0, $field => null], $headers)->assertUnprocessable();
    }
    // Query parameters cannot select ownership either.
    $this->getJson($path.'?author_id='.$first->id, $headers)->assertOk()->assertJsonPath('content', '');
    expect(UserNote::query()->sole()->content)->toBe('privado');
});

test('notes cannot be accessed by a visitor or ordinary member including the subject', function () {
    $member = User::factory()->create(['member_type' => MemberType::MEMBER]);
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $note = UserNote::query()->create(['author_id' => $admin->id, 'user_id' => $member->id, 'content' => 'private']);
    $path = '/notes/'.$member->id;
    $headers = ['X-Notes-Actor' => $admin->id];
    $this->getJson('/notes', $headers)->assertUnauthorized();
    $this->getJson($path, $headers)->assertUnauthorized();
    $this->putJson($path, ['content' => 'changed'], $headers)->assertUnauthorized();
    $headers = actAsNoteAuthor($member);
    $this->getJson('/notes', $headers)->assertForbidden();
    $this->getJson($path, $headers)->assertForbidden();
    $this->putJson($path, ['content' => 'changed'], $headers)->assertForbidden();
    expect($note->fresh()->content)->toBe('private');
});

test('inactive admin cannot access notes', function (string $method, bool $detail) {
    $admin = User::factory()->inactive()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $note = UserNote::query()->create(['author_id' => $admin->id, 'user_id' => $member->id, 'content' => 'private']);
    $headers = actAsNoteAuthor($admin);
    $path = $detail ? '/notes/'.$member->id : '/notes';
    $this->json($method, $path, $method === 'PUT' ? ['content' => 'changed'] : [], $headers)->assertForbidden();
    expect($note->fresh()->content)->toBe('private');
})->with([['GET', false], ['GET', true], ['PUT', true]]);

test('database enforces uniqueness for an author and member', function () {
    $author = User::factory()->create();
    $member = User::factory()->create();
    $values = ['author_id' => $author->id, 'user_id' => $member->id, 'content' => 'note'];
    UserNote::query()->create($values);
    expect(fn () => UserNote::query()->create($values))->toThrow(QueryException::class);
});

test('deleting an author or member removes only associated notes', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $member = User::factory()->create();
    UserNote::query()->create(['author_id' => $first->id, 'user_id' => $member->id, 'content' => 'one']);
    UserNote::query()->create(['author_id' => $second->id, 'user_id' => $member->id, 'content' => 'two']);
    $first->delete();
    expect(UserNote::query()->sole()->author_id)->toBe($second->id);
    $member->delete();
    expect(UserNote::query()->count())->toBe(0);
});

test('stale writes cannot overwrite a committed creation, update or cleared note', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $headers = actAsNoteAuthor($admin);
    $path = '/notes/'.$member->id;
    $this->putJson($path, ['content' => 'C', 'expected_version' => 0], $headers)->assertOk()->assertJsonPath('version', 1);
    $this->putJson($path, ['content' => 'B', 'expected_version' => 0], $headers)->assertConflict()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('reason', 'note_version_conflict')
        ->assertJsonPath('note.content', 'C')->assertJsonPath('note.version', 1);
    $id = UserNote::query()->sole()->id;
    $this->putJson($path, ['content' => 'D', 'expected_version' => 1], $headers)->assertOk()->assertJsonPath('version', 2);
    $this->putJson($path, ['content' => 'late', 'expected_version' => 1], $headers)->assertConflict()->assertJsonPath('note.content', 'D');
    $this->putJson($path, ['content' => '', 'expected_version' => 2], $headers)->assertOk()->assertJsonPath('version', 3);
    $this->putJson($path, ['content' => 'late', 'expected_version' => 2], $headers)->assertConflict()->assertJsonPath('note.content', '');
    expect(UserNote::query()->sole()->id)->toBe($id);
    expect(UserNote::query()->sole()->version)->toBe(3);
    expect(UserNote::query()->sole()->content)->toBe('');
});

test('version is mandatory and invalid versions cannot write', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $headers = actAsNoteAuthor($admin);
    $path = '/notes/'.$member->id;
    $this->putJson($path, ['content' => 'x'], $headers)->assertUnprocessable()->assertJsonValidationErrors('expected_version');
    foreach ([-1, null, '0', 0.5, true, 9007199254740991] as $invalid) {
        $this->putJson($path, ['content' => 'x', 'expected_version' => $invalid], $headers)->assertUnprocessable()->assertJsonValidationErrors('expected_version');
    }
    $this->putJson($path, ['content' => 'x', 'expected_version' => 0, 'version' => 99], $headers)->assertUnprocessable()->assertJsonValidationErrors('version');
    expect(UserNote::query()->count())->toBe(0);
});

test('conflict snapshots are private to the current author and never returned on session mismatch', function () {
    $first = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $second = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $path = '/notes/'.$member->id;
    $this->putJson($path, ['content' => 'private A', 'expected_version' => 0], actAsNoteAuthor($first))->assertOk();
    $headers = actAsNoteAuthor($second);
    $this->putJson($path, ['content' => 'private B', 'expected_version' => 0], $headers)->assertOk();
    $this->putJson($path, ['content' => 'late', 'expected_version' => 0], $headers)->assertConflict()->assertJsonPath('note.content', 'private B');
    $this->putJson($path, ['content' => 'late', 'expected_version' => 0], ['X-Notes-Actor' => $first->id])->assertConflict()->assertJsonMissingPath('note');
});

test('notes preserve exact content for retry reconciliation', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create();
    $headers = actAsNoteAuthor($admin);
    $path = '/notes/'.$member->id;
    $content = "  **texto**  \n";
    $this->putJson($path, ['content' => $content, 'expected_version' => 0], $headers)->assertOk()->assertJsonPath('content', $content);
    $this->putJson($path, ['content' => $content, 'expected_version' => 0], $headers)->assertConflict()->assertJsonPath('note.content', $content);
});
