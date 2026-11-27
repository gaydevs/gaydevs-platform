<?php

use App\Enums\MemberType;
use App\Models\User;
use App\Models\UserNote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('admin lists members and maintains a single private note per member', function () {
    $admin = User::factory()->create(['name' => 'Zeta', 'member_type' => MemberType::ADMIN]);
    $member = User::factory()->create(['name' => 'Ana']);
    Sanctum::actingAs($admin);

    $this->getJson('/notes')->assertOk()->assertExactJson(['members' => [
        ['id' => $member->id, 'name' => 'Ana', 'preview' => ''],
        ['id' => $admin->id, 'name' => 'Zeta', 'preview' => ''],
    ]]);
    $path = '/notes/'.$member->id;
    $this->getJson($path)->assertOk()->assertJsonPath('content', '');
    $this->putJson($path, ['content' => '**Primeira**'])->assertOk()->assertJsonPath('content', '**Primeira**');
    $this->putJson($path, ['content' => '# Nova'])->assertOk();
    $this->getJson($path)->assertOk()->assertJsonPath('content', '# Nova');
    $this->getJson('/notes')->assertOk()->assertJsonPath('members.0.preview', 'Nova')->assertJsonMissingPath('members.0.content');
    $this->putJson($path, ['content' => '**'.str_repeat('x', 200).'**'])->assertOk();
    $this->getJson('/notes')->assertOk()->assertJsonPath('members.0.preview', str_repeat('x', 157).'…');
    expect(UserNote::query()->count())->toBe(1);
    $this->putJson($path, ['content' => ''])->assertOk()->assertJsonPath('content', '');
    $this->getJson($path)->assertJsonPath('content', '');
    $this->putJson($path, [])->assertUnprocessable();
    $this->putJson($path, ['content' => str_repeat('a', 10001)])->assertUnprocessable();
    $this->putJson('/notes/00000000-0000-0000-0000-000000000000', ['content' => 'x'])->assertNotFound();
});

test('notes cannot be accessed by a visitor or ordinary member including the subject', function () {
    $member = User::factory()->create(['member_type' => MemberType::MEMBER]);
    UserNote::query()->create(['user_id' => $member->id, 'content' => 'private']);
    $path = '/notes/'.$member->id;
    $this->getJson('/notes')->assertUnauthorized();
    $this->getJson($path)->assertUnauthorized();
    $this->putJson($path, ['content' => 'changed'])->assertUnauthorized();
    Sanctum::actingAs($member);
    $this->getJson('/notes')->assertForbidden();
    $this->getJson($path)->assertForbidden();
    $this->putJson($path, ['content' => 'changed'])->assertForbidden();
    expect(UserNote::query()->find($member->id)->content)->toBe('private');
});
