<?php

use App\Enums\MemberType;
use App\Enums\PollVoteCancellationReason;
use App\Models\Poll;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\User;
use App\Services\PollSlugger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

test('only admins can create polls and the slug is generated at creation', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $this->postJson('/polls', [
        'question' => 'Qual jogo jogaremos?',
        'options' => ['Hades', 'Celeste'],
        'allow_multiple' => true,
    ])->assertCreated()->assertJsonPath('poll.slug', 'qual-jogo-jogaremos');
});

test('members cannot create polls without the admin permission', function () {
    $member = User::factory()->create(['member_type' => MemberType::MEMBER]);
    Sanctum::actingAs($member);
    $this->postJson('/polls', [
        'question' => 'Qual jogo jogaremos?',
        'options' => ['Hades', 'Celeste'],
    ])->assertForbidden();
    expect(Poll::query()->where('question', 'Qual jogo jogaremos?')->exists())->toBeFalse();
});

test('visitors cannot create polls without an authenticated admin', function () {
    $this->postJson('/polls', [
        'question' => 'Qual jogo jogaremos?',
        'options' => ['Hades', 'Celeste'],
    ])->assertUnauthorized();
    expect(Poll::query()->where('question', 'Qual jogo jogaremos?')->exists())->toBeFalse();
});

test('only admins can close an open poll', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create(['member_type' => MemberType::MEMBER]);
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Qual jogo será encerrado?',
        'slug' => 'qual-jogo-sera-encerrado',
    ]);

    Sanctum::actingAs($member);
    $this->postJson('/polls/'.$poll->slug.'/close')->assertForbidden();
    expect($poll->fresh()->closed_at)->toBeNull();

    Sanctum::actingAs($admin);
    $this->postJson('/polls/'.$poll->slug.'/close')
        ->assertOk()
        ->assertJsonPath('poll.closed', true);
    expect($poll->fresh()->closed_at)->not->toBeNull()
        ->and($poll->fresh()->closed_by_user_id)->toBe($admin->id);

    $this->getJson('/polls/'.$poll->slug.'/audit')
        ->assertOk()
        ->assertJsonPath('audit.events.1.type', 'poll_closed')
        ->assertJsonPath('audit.events.1.actor.name', $admin->name);
});

test('poll questions need two words and slug collisions use the defined suffix order', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);
    $payload = ['question' => 'Qual jogo jogaremos?', 'options' => ['Hades', 'Celeste']];
    $dateTimeSuffix = now()->format('Y-m-d-H-i');

    $this->postJson('/polls', $payload)->assertCreated();
    $this->postJson('/polls', $payload)->assertCreated()->assertJsonPath(
        'poll.slug',
        'qual-jogo-jogaremos-'.now()->format('Y-m'),
    );
    $this->postJson('/polls', $payload)->assertCreated()->assertJsonPath(
        'poll.slug',
        'qual-jogo-jogaremos-'.now()->format('Y-m-d'),
    );
    $this->postJson('/polls', $payload)->assertCreated()->assertJsonPath(
        'poll.slug',
        'qual-jogo-jogaremos-'.$dateTimeSuffix,
    );
    $this->postJson('/polls', $payload)->assertCreated()->assertJsonPath(
        'poll.slug',
        'qual-jogo-jogaremos-'.$dateTimeSuffix.'-00',
    );

    $this->postJson('/polls', ['question' => 'Uma palavra', 'options' => ['A', 'B']])->assertCreated();
    $this->postJson('/polls', ['question' => 'abcdefghij', 'options' => ['A']])->assertUnprocessable();
    $this->postJson('/polls', ['question' => 'curto', 'options' => ['A']])->assertUnprocessable();
});

test('poll question length is validated after trimming outer whitespace', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $this->postJson('/polls', [
        'question' => '         a b         ',
        'options' => ['A', 'B'],
    ])->assertUnprocessable()->assertJsonPath('errors.question.0', 'A pergunta precisa ter pelo menos 10 caracteres.');
    expect(Poll::query()->count())->toBe(0);
});

test('poll creation retries when a slug collision is detected during insert', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Poll::create(['created_by_user_id' => $admin->id, 'question' => 'Já existe?', 'slug' => 'qual-jogo']);
    $this->mock(PollSlugger::class, function (MockInterface $mock): void {
        $mock->shouldReceive('base')->twice()->andReturn('qual-jogo');
        $mock->shouldReceive('uniqueFor')->twice()->andReturn('qual-jogo', 'qual-jogo-2026-10');
    });
    Sanctum::actingAs($admin);

    $this->postJson('/polls', [
        'question' => 'Qual jogo?',
        'options' => ['A', 'B'],
    ])->assertCreated()->assertJsonPath('poll.slug', 'qual-jogo-2026-10');
});

test('poll creation rejects options that are equivalent after normalization', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $response = $this->postJson('/polls', [
        'question' => 'Qual opção escolher?',
        'options' => ['  Opção!!!  ', 'opcao'],
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['options.1']);
    expect($response->json('errors')['options.1'][0])->toBe('A opção 2 está repetida.');
    expect(Poll::query()->where('question', 'Qual opção escolher?')->exists())->toBeFalse();
});

test('poll creation requires two options unless members may add new options', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $this->postJson('/polls', [
        'question' => 'Qual jogo inicial?',
        'options' => ['Hades', ''],
        'allow_new_options' => true,
    ])->assertCreated()->assertJsonCount(1, 'poll.options');

    $response = $this->postJson('/polls', [
        'question' => 'Qual jogo final?',
        'options' => ['Hades'],
        'allow_new_options' => false,
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['options']);
    expect($response->json('errors.options.0'))->toBe('Informe ao menos 2 opções para criar a enquete.');

    $response = $this->postJson('/polls', [
        'question' => 'Qual jogo obrigatório?',
        'options' => ['', 'Celeste'],
        'allow_new_options' => true,
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['options.0']);
    expect($response->json('errors')['options.0'][0])->toBe('A opção 1 é obrigatória.');
});

test('poll creation rejects a malformed options payload without throwing an internal error', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $this->postJson('/polls', [
        'question' => 'Qual jogo escolheremos?',
        'options' => 'Hades',
    ])->assertUnprocessable()->assertJsonValidationErrors(['options']);
});

test('the authenticated poll index lists every poll and details use only the slug', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Qual jogo?', 'slug' => 'qual-jogo', 'allow_multiple' => false]);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'Hades']);

    Sanctum::actingAs($creator);
    $this->getJson('/polls')->assertOk()->assertJsonPath('polls.0.question', 'Qual jogo?');
    $this->getJson('/polls/'.$poll->slug)->assertOk()->assertJsonPath('poll.slug', 'qual-jogo');
    $this->getJson('/polls/'.$poll->id)->assertNotFound();
});

test('the authenticated poll index orders open polls first and newest within each status', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $olderOpen = now()->subDays(4);
    $newerClosed = now()->subDay();
    $newerOpen = now();
    $olderClosed = now()->subDays(3);

    $createPoll = static function (array $attributes, $createdAt, $closedAt = null): void {
        $poll = Poll::create($attributes);
        $poll->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
            'closed_at' => $closedAt,
        ])->saveQuietly();
    };

    $createPoll([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete aberta antiga',
        'slug' => 'enquete-aberta-antiga',
    ], $olderOpen);
    $createPoll([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete encerrada recente',
        'slug' => 'enquete-encerrada-recente',
    ], $newerClosed, now()->subHour());
    $createPoll([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete aberta recente',
        'slug' => 'enquete-aberta-recente',
    ], $newerOpen);
    $createPoll([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete encerrada antiga',
        'slug' => 'enquete-encerrada-antiga',
    ], $olderClosed, now()->subDays(2));

    Sanctum::actingAs($creator);
    $this->getJson('/polls?limit=10')->assertOk()
        ->assertJsonPath('polls.0.slug', 'enquete-aberta-recente')
        ->assertJsonPath('polls.1.slug', 'enquete-aberta-antiga')
        ->assertJsonPath('polls.2.slug', 'enquete-encerrada-recente')
        ->assertJsonPath('polls.3.slug', 'enquete-encerrada-antiga');
});

test('the poll index returns cursor pages without repeating polls', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    foreach (range(1, 5) as $index) {
        Poll::create([
            'created_by_user_id' => $creator->id,
            'question' => 'Enquete da página '.$index,
            'slug' => 'enquete-da-pagina-'.$index,
        ]);
    }

    Sanctum::actingAs($creator);
    $firstPage = $this->getJson('/polls')->assertOk()
        ->assertJsonCount(3, 'polls')
        ->assertJsonPath('has_more', true)
        ->json();
    expect($firstPage['polls'][0]['created_at'])->toBeString();

    $secondPage = $this->getJson('/polls?cursor='.urlencode($firstPage['next_cursor']))->assertOk()
        ->assertJsonCount(2, 'polls')
        ->assertJsonPath('has_more', false)
        ->json();

    expect(collect($firstPage['polls'])->pluck('id')->intersect(collect($secondPage['polls'])->pluck('id')))->toBeEmpty();
    expect(collect($firstPage['polls'])->merge($secondPage['polls']))->toHaveCount(5);
});

test('the poll index keeps a poll with a future closing date out of the next cursor page', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $createPoll = static function (string $question, string $slug, $createdAt, $closedAt = null) use ($creator): void {
        $poll = Poll::create([
            'created_by_user_id' => $creator->id,
            'question' => $question,
            'slug' => $slug,
        ]);
        $poll->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
            'closed_at' => $closedAt,
        ])->saveQuietly();
    };

    $createPoll('Enquete aberta recente', 'enquete-aberta-recente', now()->subMinutes(1));
    $createPoll('Enquete aberta anterior', 'enquete-aberta-anterior', now()->subMinutes(2));
    $createPoll('Enquete com encerramento futuro', 'enquete-encerramento-futuro', now()->subMinutes(3), now()->addHour());
    $createPoll('Enquete aberta antiga', 'enquete-aberta-antiga', now()->subMinutes(4));

    Sanctum::actingAs($creator);
    $firstPage = $this->getJson('/polls')->assertOk()
        ->assertJsonPath('polls.2.slug', 'enquete-encerramento-futuro')
        ->json();

    $secondPage = $this->getJson('/polls?cursor='.urlencode($firstPage['next_cursor']))->assertOk()
        ->assertJsonCount(1, 'polls')
        ->assertJsonPath('polls.0.slug', 'enquete-aberta-antiga')
        ->json();

    expect(collect($secondPage['polls'])->pluck('slug'))->not->toContain('enquete-encerramento-futuro');
});

test('the poll index returns only polls changed since the last sync', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $voter = User::factory()->create();
    $unchanged = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete não alterada', 'slug' => 'enquete-nao-alterada']);
    $option = PollOption::create(['poll_id' => $unchanged->id, 'label' => 'Opção antiga']);
    $unchanged->forceFill(['created_at' => now()->subHours(2), 'updated_at' => now()->subHours(2)])->saveQuietly();
    $since = now()->subHour();

    $newPoll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete nova depois', 'slug' => 'enquete-nova-depois']);
    PollOption::create(['poll_id' => $unchanged->id, 'label' => 'Opção nova depois']);
    PollVote::create(['poll_id' => $unchanged->id, 'poll_option_id' => $option->id, 'user_id' => $voter->id]);

    Sanctum::actingAs($creator);
    $response = $this->getJson('/polls?since='.urlencode($since->toISOString()))->assertOk();

    expect($response->json('polls'))->toHaveCount(2)
        ->and(collect($response->json('polls'))->pluck('id')->all())->toContain($newPoll->id, $unchanged->id);
});

test('the poll index rejects malformed cursors', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    Sanctum::actingAs($admin);

    $this->getJson('/polls?cursor=not-a-valid-cursor')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cursor']);
});

test('the incremental poll index includes a loaded poll after it is closed', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Enquete que será encerrada',
        'slug' => 'enquete-que-sera-encerrada',
    ]);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'Opção']);
    $since = now()->subMinutes(5);

    Sanctum::actingAs($admin);
    $this->postJson('/polls/'.$poll->slug.'/close')->assertOk();

    $this->getJson('/polls?since='.urlencode($since->toISOString()))
        ->assertOk()
        ->assertJsonCount(1, 'polls')
        ->assertJsonPath('polls.0.id', $poll->id)
        ->assertJsonPath('polls.0.closed', true);
});

test('visitors cannot forge a vote while public poll details remain readable', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Qual jogo?', 'slug' => 'qual-jogo-publico']);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'Hades']);

    $this->getJson('/polls')->assertUnauthorized();
    $this->getJson('/polls/'.$poll->slug)->assertOk();
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$option->id], 'removed_options' => []])
        ->assertUnauthorized();
    expect($poll->votes()->count())->toBe(0);
});

test('a successful vote suggests only open polls without an active vote for the member', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $voter = User::factory()->create();
    $current = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete atual', 'slug' => 'enquete-atual']);
    $currentOption = PollOption::create(['poll_id' => $current->id, 'label' => 'Agora']);
    foreach (range(1, 3) as $number) {
        $candidate = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Outra enquete aberta '.$number, 'slug' => 'outra-enquete-aberta-'.$number]);
        PollOption::create(['poll_id' => $candidate->id, 'label' => 'Opção']);
    }
    $visibleCandidateOption = PollOption::create(['poll_id' => $candidate->id, 'label' => 'Outra opção visível']);
    PollOption::create(['poll_id' => $candidate->id, 'label' => 'Opção ocultada', 'hidden_at' => now()]);
    $otherVoter = User::factory()->create();
    $candidate->votes()->create(['poll_option_id' => $visibleCandidateOption->id, 'user_id' => $otherVoter->id]);
    $unvoted = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete ainda sem voto', 'slug' => 'enquete-sem-voto']);
    PollOption::create(['poll_id' => $unvoted->id, 'label' => 'Opção']);
    $alreadyVoted = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete já votada', 'slug' => 'enquete-ja-votada']);
    $alreadyVotedOption = PollOption::create(['poll_id' => $alreadyVoted->id, 'label' => 'Opção']);
    $alreadyVoted->votes()->create(['poll_option_id' => $alreadyVotedOption->id, 'user_id' => $voter->id]);
    $closed = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete encerrada', 'slug' => 'enquete-encerrada-sugestao', 'closed_at' => now()->subMinute()]);
    PollOption::create(['poll_id' => $closed->id, 'label' => 'Opção']);
    $withoutVisibleOptions = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete sem opção visível', 'slug' => 'enquete-sem-opcao-visivel']);
    PollOption::create(['poll_id' => $withoutVisibleOptions->id, 'label' => 'Opção ocultada', 'hidden_at' => now()]);

    Sanctum::actingAs($voter);
    $response = $this->postJson('/polls/'.$current->slug.'/responses', [
        'added_options' => [$currentOption->id],
        'removed_options' => [],
    ])->assertOk()->assertJsonCount(3, 'suggested_polls');

    $suggestedSlugs = collect($response->json('suggested_polls'))->pluck('slug');
    expect($suggestedSlugs)->toContain('enquete-sem-voto')
        ->not->toContain('enquete-ja-votada')
        ->not->toContain('enquete-encerrada-sugestao')
        ->not->toContain('enquete-sem-opcao-visivel')
        ->not->toContain('enquete-atual');

    $suggestedCandidate = collect($response->json('suggested_polls'))->firstWhere('id', $candidate->id);
    expect($suggestedCandidate)->toMatchArray([
        'started_at' => null,
        'started_on' => null,
        'options_count' => 2,
        'total_votes' => 1,
    ]);
});

test('dismissed poll suggestions are excluded from future vote responses', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $voter = User::factory()->create();
    $current = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete atual', 'slug' => 'enquete-atual-dismissed']);
    $currentOption = PollOption::create(['poll_id' => $current->id, 'label' => 'Agora']);
    $dismissed = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete ignorada', 'slug' => 'enquete-ignorada']);
    PollOption::create(['poll_id' => $dismissed->id, 'label' => 'Opção']);

    Sanctum::actingAs($voter);
    $this->postJson('/me/preferences/poll-suggestions/dismiss', ['poll_id' => $dismissed->id])->assertOk();
    $this->postJson('/polls/'.$current->slug.'/responses', [
        'added_options' => [$currentOption->id],
        'removed_options' => [],
    ])->assertOk()->assertJsonCount(0, 'suggested_polls');
});

test('visitors cannot add options to an open poll', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Sugestões abertas?',
        'slug' => 'sugestoes-abertas-publico',
        'allow_new_options' => true,
    ]);

    $this->postJson('/polls/'.$poll->slug.'/options', ['label' => 'Nova opção'])->assertUnauthorized();
    expect($poll->options()->count())->toBe(0);
});

test('a response cannot use an option belonging to another poll', function () {
    $creator = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $voter = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Enquete protegida?', 'slug' => 'enquete-protegida']);
    $otherPoll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Outra enquete?', 'slug' => 'outra-enquete-protegida']);
    $foreignOption = PollOption::create(['poll_id' => $otherPoll->id, 'label' => 'Opção externa']);

    Sanctum::actingAs($voter);
    $this->postJson('/polls/'.$poll->slug.'/responses', [
        'added_options' => [$foreignOption->id],
        'removed_options' => [],
    ])->assertUnprocessable()
        ->assertJsonPath('errors.options.0', 'Uma ou mais opções estão ocultas ou são inválidas.');

    expect($poll->votes()->count())->toBe(0);
});

test('members cannot use the admin option hiding endpoint', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create(['member_type' => MemberType::MEMBER]);
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Qual opção ocultar?',
        'slug' => 'qual-opcao-ocultar',
    ]);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);

    Sanctum::actingAs($member);
    $this->postJson('/polls/'.$poll->slug.'/options/'.$option->id.'/hide')->assertForbidden();
    expect($option->fresh()->hidden_at)->toBeNull();
});

test('poll audit requires authentication and lists active and canceled vote records', function () {
    $creator = User::factory()->create();
    $voter = User::factory()->create(['name' => 'Gdev Auditor']);
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Histórico de votos?', 'slug' => 'historico-de-votos']);
    $poll->forceFill(['created_at' => now()->subDays(8), 'updated_at' => now()->subDays(8), 'closed_at' => now()->subDay()])->saveQuietly();
    $first = PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $creator->id, 'label' => 'Primeira']);
    $first->forceFill(['created_at' => now()->subDays(7), 'updated_at' => now()->subDays(7)])->saveQuietly();
    $anonymous = $poll->votes()->create(['poll_option_id' => $first->id, 'user_id' => null]);
    $anonymous->forceFill(['created_at' => now()->subDays(6), 'updated_at' => now()->subDays(6)])->saveQuietly();
    $second = PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $voter->id, 'label' => 'Segunda']);
    $second->forceFill(['created_at' => now()->subDays(5), 'updated_at' => now()->subDays(5)])->saveQuietly();
    $canceled = $poll->votes()->create(['poll_option_id' => $first->id, 'user_id' => $voter->id]);
    $canceled->forceFill(['created_at' => now()->subDays(4), 'updated_at' => now()->subDays(4)])->saveQuietly();
    $canceled->update([
        'status' => 'canceled',
        'cancellation_reason' => PollVoteCancellationReason::REPLACED,
        'canceled_at' => now()->subDays(3),
        'updated_at' => now()->subDays(3),
    ]);
    $active = $poll->votes()->create(['poll_option_id' => $second->id, 'user_id' => $voter->id]);
    $active->forceFill(['created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2)])->saveQuietly();

    $this->getJson('/polls/'.$poll->slug.'/audit')->assertUnauthorized();

    Sanctum::actingAs($voter);
    $response = $this->getJson('/polls/'.$poll->slug.'/audit')->assertOk();
    expect($response->json('audit.events'))->toHaveCount(8);
    $response->assertJsonPath('audit.poll.slug', 'historico-de-votos')
        ->assertJsonPath('audit.poll.creator.name', $creator->name)
        ->assertJsonPath('audit.events.0.type', 'poll_created')
        ->assertJsonPath('audit.events.0.actor.name', $creator->name)
        ->assertJsonPath('audit.events.1.type', 'option_added')
        ->assertJsonPath('audit.events.1.actor.name', $creator->name)
        ->assertJsonPath('audit.events.2.type', 'vote_recorded')
        ->assertJsonPath('audit.events.2.actor', null)
        ->assertJsonPath('audit.events.3.type', 'option_added')
        ->assertJsonPath('audit.events.3.actor.name', 'Gdev Auditor')
        ->assertJsonPath('audit.events.4.type', 'vote_recorded')
        ->assertJsonPath('audit.events.4.actor.name', 'Gdev Auditor')
        ->assertJsonPath('audit.events.5.type', 'vote_canceled')
        ->assertJsonPath('audit.events.5.cancellation_reason', 'replaced')
        ->assertJsonPath('audit.events.6.type', 'vote_recorded')
        ->assertJsonPath('audit.events.7.type', 'poll_closed');
});

test('a poll without votes reports zero counts and the empty state message', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Sem respostas?', 'slug' => 'sem-respostas']);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.total_votes', 0)
        ->assertJsonPath('poll.message', 'Ainda não há votos')
        ->assertJsonPath('poll.options.0.votes', 0)
        ->assertJsonPath('poll.options.0.percentage', 0)
        ->assertJsonPath('poll.options.1.votes', 0)
        ->assertJsonPath('poll.options.1.percentage', 0);
});

test('a public poll shows raw selection percentages and authenticated voters', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Escolha', 'slug' => 'escolha', 'allow_multiple' => true]);
    $first = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $second = PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);
    $one = User::factory()->create(['name' => 'Gdev Um']);
    $two = User::factory()->create(['name' => 'Gdev Dois']);
    $poll->votes()->createMany([
        ['poll_option_id' => $first->id, 'user_id' => $one->id],
        ['poll_option_id' => $first->id, 'user_id' => $two->id],
        ['poll_option_id' => $second->id, 'user_id' => $two->id],
    ]);

    $this->getJson('/polls/'.$poll->fresh()->slug)->assertOk()
        ->assertJsonPath('poll.total_votes', 3)
        ->assertJsonPath('poll.options.0.percentage', 66.67)
        ->assertJsonPath('poll.options.0.votes', 2)
        ->assertJsonMissingPath('poll.options.0.voters');
    Sanctum::actingAs($one);
    $this->getJson('/polls/'.$poll->fresh()->slug)->assertOk()
        ->assertJsonPath('poll.options.0.voters.0.name', 'Gdev Um')
        ->assertJsonPath('poll.selected_options.0', $first->id);
});

test('authenticated voters are listed from the earliest vote to the latest', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Ordem dos votos', 'slug' => 'ordem-dos-votos']);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $firstVoter = User::factory()->create(['name' => 'Primeiro Gdev']);
    $lastVoter = User::factory()->create(['name' => 'Último Gdev']);
    $firstVoteAt = now()->subMinute();
    $poll->votes()->create([
        'poll_option_id' => $option->id,
        'user_id' => $firstVoter->id,
        'created_at' => $firstVoteAt,
        'updated_at' => $firstVoteAt,
    ]);
    $poll->votes()->create([
        'poll_option_id' => $option->id,
        'user_id' => $lastVoter->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    Sanctum::actingAs($creator);
    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.voters.0.name', 'Primeiro Gdev')
        ->assertJsonPath('poll.options.0.voters.1.name', 'Último Gdev');
});

test('legacy anonymous votes count independently and never expose a voter name', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Escolha legada',
        'slug' => 'escolha-legada',
        'allow_multiple' => false,
    ]);
    $first = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $second = PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);
    $identified = User::factory()->create(['name' => 'Gdev Identificado']);
    $poll->votes()->createMany([
        ['poll_option_id' => $first->id, 'user_id' => null],
        ['poll_option_id' => $first->id, 'user_id' => null],
        ['poll_option_id' => $second->id, 'user_id' => $identified->id],
    ]);

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.percentage', 66.67)
        ->assertJsonMissingPath('poll.options.0.voters');

    Sanctum::actingAs($identified);
    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.anonymous_votes', 2)
        ->assertJsonPath('poll.options.1.voters.0.name', 'Gdev Identificado');
});

test('active votes on hidden options do not affect visible results', function () {
    $creator = User::factory()->create();
    $voter = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Resultados protegidos?',
        'slug' => 'resultados-protegidos',
    ]);
    $visible = PollOption::create(['poll_id' => $poll->id, 'label' => 'Visível']);
    $hidden = PollOption::create(['poll_id' => $poll->id, 'label' => 'Ocultada']);
    $hidden->forceFill(['hidden_at' => now(), 'hidden_by_user_id' => $creator->id])->saveQuietly();
    $poll->votes()->createMany([
        ['poll_option_id' => $visible->id, 'user_id' => $voter->id],
        ['poll_option_id' => $hidden->id, 'user_id' => $voter->id],
    ]);

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.total_votes', 1)
        ->assertJsonPath('poll.options.0.id', $visible->id)
        ->assertJsonPath('poll.options.0.votes', 1)
        ->assertJsonMissing(['id' => $hidden->id]);

    Sanctum::actingAs($voter);
    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.selected_options.0', $visible->id)
        ->assertJsonMissing(['selected_options' => [$hidden->id]]);
});

test('poll creator and distinct option creator are exposed with the correct visibility', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN, 'name' => 'Gdev Admin']);
    $member = User::factory()->create(['name' => 'Gdev Membro']);
    $poll = Poll::create(['created_by_user_id' => $admin->id, 'question' => 'Quem criou?', 'slug' => 'quem-criou']);
    PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $admin->id, 'label' => 'Opção do admin']);
    PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $member->id, 'label' => 'Opção do membro']);

    Sanctum::actingAs($member);
    $response = $this->getJson('/polls/'.$poll->slug)->assertOk();
    expect(collect($response->json('poll.options'))->firstWhere('label', 'Opção do admin'))->not->toHaveKey('creator');
    expect(collect($response->json('poll.options'))->firstWhere('label', 'Opção do membro')['creator']['name'])
        ->toBe('Gdev Membro');
    $response->assertJsonPath('poll.creator.name', 'Gdev Admin');
});

test('members cannot add options when the poll does not allow them', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Opção bloqueada?', 'slug' => 'opcao-bloqueada']);
    $member = User::factory()->create();
    Sanctum::actingAs($member);

    $this->postJson('/polls/'.$poll->slug.'/options', ['label' => 'Nova opção'])->assertUnprocessable();
    expect($poll->options()->count())->toBe(0);
});

test('new options compare normalized labels, preserve the original label and explain duplicates', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Sugestões abertas?',
        'slug' => 'sugestoes-abertas',
        'allow_new_options' => true,
    ]);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'Opção']);
    $member = User::factory()->create();
    Sanctum::actingAs($member);

    $this->postJson('/polls/'.$poll->slug.'/options', ['label' => '  OPÇAO!!!  '])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['label'])
        ->assertJsonPath('errors.label.0', 'Já existe uma opção semelhante: "Opção".');

    $hidden = PollOption::create(['poll_id' => $poll->id, 'label' => 'Teste']);
    $hidden->forceFill(['hidden_at' => now(), 'hidden_by_user_id' => $creator->id])->saveQuietly();
    $this->postJson('/polls/'.$poll->slug.'/options', ['label' => ' teste '])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['label'])
        ->assertJsonPath('errors.label.0', 'A opção semelhante está ocultada: "Teste".');

    $rawLabel = '  Nova   Opção!!!  ';
    $created = $this->postJson('/polls/'.$poll->slug.'/options', ['label' => $rawLabel])
        ->assertCreated()->json('option.id');
    expect(PollOption::find($created)->label)->toBe($rawLabel);
});

test('authenticated members can replace a response but cannot exceed single-choice configuration', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Escolha', 'slug' => 'escolha', 'allow_multiple' => false]);
    $first = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $second = PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$first->id], 'removed_options' => []])->assertOk();
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$second->id], 'removed_options' => [$first->id]])->assertOk();
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'active')->pluck('poll_option_id')->all())->toBe([$second->id]);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->count())->toBe(1);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->firstOrFail()->cancellation_reason)
        ->toBe(PollVoteCancellationReason::REPLACED);
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$first->id, $second->id], 'removed_options' => []])->assertUnprocessable();
});

test('authenticated members can withdraw a single-choice response', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Escolha', 'slug' => 'escolha-unica']);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$option->id], 'removed_options' => []])->assertOk();
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [], 'removed_options' => [$option->id]])->assertOk();

    expect($poll->votes()->where('user_id', $user->id)->where('status', 'active')->count())->toBe(0);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->count())->toBe(1);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->firstOrFail()->cancellation_reason)
        ->toBe(PollVoteCancellationReason::WITHDRAWN);
});

test('repeating the same response does not create duplicate active votes', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Voto repetido?', 'slug' => 'voto-repetido']);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $payload = ['added_options' => [$option->id], 'removed_options' => []];
    $this->postJson('/polls/'.$poll->slug.'/responses', $payload)->assertOk();
    $this->postJson('/polls/'.$poll->slug.'/responses', $payload)->assertOk();

    expect($poll->votes()->where('user_id', $user->id)->count())->toBe(1);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'active')->count())->toBe(1);
});

test('response changes only append and cancel the affected votes', function () {
    $creator = User::factory()->create();
    $poll = Poll::create(['created_by_user_id' => $creator->id, 'question' => 'Escolha várias', 'slug' => 'escolha-varias', 'allow_multiple' => true]);
    $first = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $second = PollOption::create(['poll_id' => $poll->id, 'label' => 'B']);
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$first->id], 'removed_options' => []])->assertOk();
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$second->id], 'removed_options' => []])->assertOk();
    expect($poll->votes()->where('user_id', $user->id)->count())->toBe(2);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'active')->pluck('poll_option_id')->all())
        ->toEqualCanonicalizing([$first->id, $second->id]);

    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [], 'removed_options' => [$first->id]])->assertOk();
    expect($poll->votes()->where('user_id', $user->id)->count())->toBe(2);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'active')->pluck('poll_option_id')->all())->toBe([$second->id]);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->pluck('poll_option_id')->all())->toBe([$first->id]);
    expect($poll->votes()->where('user_id', $user->id)->where('status', 'canceled')->firstOrFail()->cancellation_reason)
        ->toBe(PollVoteCancellationReason::WITHDRAWN);
});

test('closed polls reject forged votes and option creation requests', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Enquete encerrada',
        'slug' => 'enquete-encerrada',
        'closed_at' => now()->subMinute(),
    ]);
    $option = PollOption::create(['poll_id' => $poll->id, 'label' => 'A']);
    $voter = User::factory()->create();
    Sanctum::actingAs($voter);

    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$option->id], 'removed_options' => []])
        ->assertUnprocessable()->assertJsonValidationErrors(['poll']);
    $this->postJson('/polls/'.$poll->slug.'/options', ['label' => 'Nova opção'])
        ->assertUnprocessable();
    expect($poll->votes()->count())->toBe(0);
});

test('poll options are ordered by raw vote count and then creation order', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Opções ordenadas',
        'slug' => 'opcoes-ordenadas',
    ]);
    $firstCreated = PollOption::create(['poll_id' => $poll->id, 'label' => 'Primeira cadastrada']);
    $mostVoted = PollOption::create(['poll_id' => $poll->id, 'label' => 'Mais votada']);
    $voterOne = User::factory()->create();
    $voterTwo = User::factory()->create();
    $poll->votes()->createMany([
        ['poll_option_id' => $mostVoted->id, 'user_id' => $voterOne->id],
        ['poll_option_id' => $mostVoted->id, 'user_id' => $voterTwo->id],
        ['poll_option_id' => $firstCreated->id, 'user_id' => $voterOne->id],
    ]);

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.label', 'Mais votada')
        ->assertJsonPath('poll.options.1.label', 'Primeira cadastrada');
});

test('multiple-choice poll options are ordered by their raw selection count', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Opções múltiplas ordenadas',
        'slug' => 'opcoes-multiplas-ordenadas',
        'allow_multiple' => true,
    ]);
    $firstCreated = PollOption::create(['poll_id' => $poll->id, 'label' => 'Primeira cadastrada']);
    $mostSelected = PollOption::create(['poll_id' => $poll->id, 'label' => 'Mais selecionada']);
    $otherOptions = collect(['Outra 1', 'Outra 2', 'Outra 3'])
        ->map(fn (string $label): PollOption => PollOption::create(['poll_id' => $poll->id, 'label' => $label]));
    $singleChoiceVoter = User::factory()->create();
    $multipleChoiceVoterOne = User::factory()->create();
    $multipleChoiceVoterTwo = User::factory()->create();
    $poll->votes()->createMany([
        ['poll_option_id' => $firstCreated->id, 'user_id' => $singleChoiceVoter->id],
        ['poll_option_id' => $mostSelected->id, 'user_id' => $multipleChoiceVoterOne->id],
        ['poll_option_id' => $mostSelected->id, 'user_id' => $multipleChoiceVoterTwo->id],
        ...$otherOptions->flatMap(fn (PollOption $option): array => [
            ['poll_option_id' => $option->id, 'user_id' => $multipleChoiceVoterOne->id],
            ['poll_option_id' => $option->id, 'user_id' => $multipleChoiceVoterTwo->id],
        ])->all(),
    ]);

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.label', 'Mais selecionada')
        ->assertJsonPath('poll.options.0.percentage', 22.22)
        ->assertJsonPath('poll.options.1.label', 'Outra 1')
        ->assertJsonPath('poll.options.1.percentage', 22.22)
        ->assertJsonPath('poll.options.4.label', 'Primeira cadastrada')
        ->assertJsonPath('poll.options.4.percentage', 11.11);
});

test('rounded percentages do not reorder options with the same vote count', function () {
    $creator = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'Empates estáveis',
        'slug' => 'empates-estaveis',
        'allow_multiple' => true,
    ]);
    $options = collect(['Primeira', 'Segunda', 'Terceira', 'Quarta'])
        ->map(fn (string $label): PollOption => PollOption::create(['poll_id' => $poll->id, 'label' => $label]));
    $voters = User::factory()->count(15)->create();

    foreach ($options->take(3) as $optionIndex => $option) {
        foreach ($voters->slice($optionIndex * 4, 4) as $voter) {
            $poll->votes()->create(['poll_option_id' => $option->id, 'user_id' => $voter->id]);
        }
    }
    foreach ($voters->slice(12) as $voter) {
        $poll->votes()->create(['poll_option_id' => $options[3]->id, 'user_id' => $voter->id]);
    }

    $this->getJson('/polls/'.$poll->slug)->assertOk()
        ->assertJsonPath('poll.options.0.label', 'Primeira')
        ->assertJsonPath('poll.options.0.percentage', 26.67)
        ->assertJsonPath('poll.options.1.label', 'Segunda')
        ->assertJsonPath('poll.options.2.label', 'Terceira')
        ->assertJsonPath('poll.options.3.label', 'Quarta')
        ->assertJsonPath('poll.options.3.percentage', 20);
});

test('option creators can remove an unclaimed option and cannot remove one with another member vote', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $member = User::factory()->create(['name' => 'Gdev Criador']);
    $other = User::factory()->create(['name' => 'Gdev Votante']);
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Qual jogo?',
        'slug' => 'qual-jogo',
        'allow_new_options' => true,
    ]);
    PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $admin->id, 'label' => 'Opção inicial']);

    Sanctum::actingAs($member);
    $created = $this->postJson('/polls/'.$poll->slug.'/options', ['label' => 'Opção do membro'])
        ->assertCreated()->json('option.id');
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$created], 'removed_options' => []])->assertOk();
    $this->deleteJson('/polls/'.$poll->slug.'/options/'.$created)->assertNoContent();
    expect($poll->votes()->where('poll_option_id', $created)->firstOrFail()->cancellation_reason)
        ->toBe(PollVoteCancellationReason::OPTION_HIDDEN);

    $second = $this->postJson('/polls/'.$poll->slug.'/options', ['label' => 'Opção disputada'])
        ->assertCreated()->json('option.id');
    Sanctum::actingAs($other);
    $this->postJson('/polls/'.$poll->slug.'/responses', ['added_options' => [$second], 'removed_options' => []])->assertOk();
    Sanctum::actingAs($member);
    $this->deleteJson('/polls/'.$poll->slug.'/options/'.$second)->assertUnprocessable();
    expect(PollOption::find($second))->not->toBeNull();

    Sanctum::actingAs($admin);
    $response = $this->postJson('/polls/'.$poll->slug.'/options/'.$second.'/hide')->assertOk();
    expect(collect($response->json('poll.options'))->pluck('id'))->not->toContain($second);
    expect(PollOption::find($second)->hidden_by_user_id)->toBe($admin->id)
        ->and($poll->votes()->where('poll_option_id', $second)->firstOrFail()->cancellation_reason)
        ->toBe(PollVoteCancellationReason::OPTION_HIDDEN);

    $audit = $this->getJson('/polls/'.$poll->slug.'/audit')->assertOk();
    $hiddenEvent = collect($audit->json('audit.events'))->first(fn (array $event): bool => $event['type'] === 'option_hidden' && $event['option_id'] === $second);
    expect($hiddenEvent['actor']['name'])->toBe($admin->name);
});

test('a stale poll page cannot vote on a hidden option', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $voter = User::factory()->create();
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Qual opção está disponível?',
        'slug' => 'qual-opcao-disponivel',
        'allow_new_options' => true,
    ]);
    PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $admin->id, 'label' => 'Opção visível']);
    $hidden = PollOption::create(['poll_id' => $poll->id, 'created_by_user_id' => $admin->id, 'label' => 'Opção ocultada']);

    Sanctum::actingAs($admin);
    $this->postJson('/polls/'.$poll->slug.'/options/'.$hidden->id.'/hide')->assertOk();

    Sanctum::actingAs($voter);
    $this->postJson('/polls/'.$poll->slug.'/responses', [
        'added_options' => [$hidden->id],
        'removed_options' => [],
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.options.0', 'Uma ou mais opções estão ocultas ou são inválidas.');

    expect($poll->votes()->where('poll_option_id', $hidden->id)->count())->toBe(0);
});

test('hiding an option cannot break the poll minimum', function () {
    $admin = User::factory()->create(['member_type' => MemberType::ADMIN]);
    $poll = Poll::create([
        'created_by_user_id' => $admin->id,
        'question' => 'Qual jogo mínimo?',
        'slug' => 'qual-jogo-minimo',
        'allow_new_options' => false,
    ]);
    $first = PollOption::create(['poll_id' => $poll->id, 'label' => 'Primeira']);
    PollOption::create(['poll_id' => $poll->id, 'label' => 'Segunda']);

    Sanctum::actingAs($admin);
    $this->postJson('/polls/'.$poll->slug.'/options/'.$first->id.'/hide')
        ->assertUnprocessable()
        ->assertJsonPath('errors.options.0', 'A enquete precisa manter pelo menos 2 opções.');
    expect($first->fresh()->hidden_at)->toBeNull();
});
