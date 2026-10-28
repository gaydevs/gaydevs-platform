<?php

use App\Models\Poll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config()->set('app.frontend_url', 'https://frontend.example.test/gaydevs/platform');
});

test('poll list social preview exposes the configured metadata', function () {
    $this->get('/social/preview/polls')
        ->assertOk()
        ->assertHeader('content-type', 'text/html; charset=UTF-8')
        ->assertSee('<meta property="og:title" content="/gdevs/polls">', false)
        ->assertSee('vote nas enquetes da comunidade, participe das decisões 🗳️', false)
        ->assertSee('https://frontend.example.test/gaydevs/platform/polls-preview.png', false)
        ->assertSee('<meta property="og:type" content="website">', false)
        ->assertSee('<meta property="og:url" content="https://frontend.example.test/gaydevs/platform/polls/">', false)
        ->assertSee('<meta name="twitter:card" content="summary">', false);
});

test('poll detail social preview uses the poll question and canonical frontend url', function () {
    $creator = User::factory()->create();
    Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'O que vc quer jogar no JogaYdev?',
        'slug' => 'o-que-vc-quer-jogar-no-jogaydev',
    ]);

    $this->get('/social/preview/polls/o-que-vc-quer-jogar-no-jogaydev')
        ->assertOk()
        ->assertSee('<meta property="og:title" content="O que vc quer jogar no JogaYdev?">', false)
        ->assertSee('vote e veja o que a comunidade gaydevs prefere 🗳️', false)
        ->assertSee('<meta property="og:url" content="https://frontend.example.test/gaydevs/platform/polls/o-que-vc-quer-jogar-no-jogaydev">', false)
        ->assertSee('<meta name="twitter:title" content="O que vc quer jogar no JogaYdev?">', false);
});

test('unknown frontend path uses global social metadata', function () {
    $this->get('/social/preview/events/php-community-summit')
        ->assertOk()
        ->assertSee('<meta property="og:title" content="gaydevs — uma comunidade para gays 🌈 e devs 💻">', false)
        ->assertSee('uma comunidade para gays 🌈 e devs 💻 — tecnologia, carreira, amizade, eventos e os surtos da vida dev.', false)
        ->assertSee('https://frontend.example.test/gaydevs/platform/brand-icon-512.png', false)
        ->assertSee('<meta property="og:url" content="https://frontend.example.test/gaydevs/platform/events/php-community-summit">', false);
});

test('unsupported nested poll path falls back instead of resolving a poll', function () {
    $this->get('/social/preview/polls/not-a-detail/extra')
        ->assertOk()
        ->assertSee('<meta property="og:title" content="gaydevs — uma comunidade para gays 🌈 e devs 💻">', false)
        ->assertSee('<meta property="og:url" content="https://frontend.example.test/gaydevs/platform/polls/not-a-detail/extra">', false);
});

test('root social preview uses global metadata', function () {
    $this->get('/social/preview')
        ->assertOk()
        ->assertSee('<meta property="og:url" content="https://frontend.example.test/gaydevs/platform/">', false);
});

test('social preview fails explicitly when frontend url is not configured', function () {
    config()->set('app.frontend_url', null);

    $this->get('/social/preview/polls')->assertStatus(500);
});
