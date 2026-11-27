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
    $this->getJson($path, $headers)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('content', '');
    $this->putJson($path, ['content' => '**Primeira**'], $headers)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('content', '**Primeira**');
    $note = UserNote::query()->sole();
    expect(Str::isUuid($note->id, 7))->toBeTrue();
    expect($note->author_id)->toBe($admin->id);
    expect($note->user_id)->toBe($member->id);
    $this->putJson($path, ['content' => '# Nova'], $headers)->assertOk();
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', '# Nova');
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Nova')->assertJsonMissingPath('members.0.content');
    $this->putJson($path, ['content' => '**'.str_repeat('x', 200).'**'], $headers)->assertOk();
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', str_repeat('x', 157).'…');
    expect(UserNote::query()->sole()->id)->toBe($note->id);
    $this->putJson($path, ['content' => ''], $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson($path, $headers)->assertJsonPath('content', '');
    $this->putJson($path, [], $headers)->assertUnprocessable();
    $this->putJson($path, ['content' => str_repeat('a', 10001)], $headers)->assertUnprocessable();
    $this->putJson('/notes/00000000-0000-0000-0000-000000000000', ['content' => 'x'], $headers)->assertNotFound();
});

test('two admins have independent notes and previews, including notes about one another', function () {
    $member = User::factory()->create(['name' => 'Ana']);
    $first = User::factory()->create(['name' => 'Beta', 'member_type' => MemberType::ADMIN]);
    $second = User::factory()->create(['name' => 'Gama', 'member_type' => MemberType::ADMIN]);
    $path = '/notes/'.$member->id;
    $headers = actAsNoteAuthor($first);
    $this->putJson($path, ['content' => 'Primeiro privado'], $headers)->assertOk();
    $this->putJson('/notes/'.$second->id, ['content' => 'Sobre o segundo admin'], $headers)->assertOk();

    $headers = actAsNoteAuthor($second);
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson('/notes/'.$second->id, $headers)->assertOk()->assertJsonPath('content', '');
    $this->getJson('/notes', $headers)->assertOk()->assertExactJson(['members' => [
        ['id' => $member->id, 'name' => 'Ana', 'preview' => ''],
        ['id' => $first->id, 'name' => 'Beta', 'preview' => ''],
        ['id' => $second->id, 'name' => 'Gama', 'preview' => ''],
    ]]);
    $this->putJson($path, ['content' => 'Segundo privado'], $headers)->assertOk();
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Segundo privado')
        ->assertJsonMissingPath('members.0.author_id')->assertJsonMissingPath('members.0.content');
    $this->putJson($path, ['content' => ''], $headers)->assertOk();
    expect(UserNote::query()->where('author_id', $second->id)->where('user_id', $member->id)->sole()->content)->toBe('');

    $headers = actAsNoteAuthor($first);
    $this->getJson($path, $headers)->assertOk()->assertJsonPath('content', 'Primeiro privado');
    $this->getJson('/notes', $headers)->assertOk()->assertJsonPath('members.0.preview', 'Primeiro privado')
        ->assertJsonPath('members.2.preview', 'Sobre o segundo admin');
    $this->putJson($path, ['content' => 'Atualizado'], $headers)->assertOk();
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
        $this->putJson($path, ['content' => 'changed', $field => $value], $headers)->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson($path, ['content' => 'changed', $field => null], $headers)->assertUnprocessable();
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
