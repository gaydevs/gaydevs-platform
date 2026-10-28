<?php

use App\Models\Poll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('poll list social preview exposes the configured metadata', function () {
    $this->get('/social/polls-preview')
        ->assertOk()
        ->assertHeader('content-type', 'text/html; charset=UTF-8')
        ->assertSee('<meta property="og:title" content="/gdevs/polls">', false)
        ->assertSee('vote nas enquetes da comunidade, participe das decisões 🗳️', false)
        ->assertSee('https://vettoretti.dev/gaydevs/platform/polls-preview.png', false)
        ->assertSee('<meta property="og:type" content="website">', false)
        ->assertSee('<meta property="og:url" content="https://vettoretti.dev/gaydevs/platform/polls/">', false)
        ->assertSee('<meta name="twitter:card" content="summary">', false);
});

test('poll detail social preview uses the poll question and canonical frontend url', function () {
    $creator = User::factory()->create();
    Poll::create([
        'created_by_user_id' => $creator->id,
        'question' => 'O que vc quer jogar no JogaYdev?',
        'slug' => 'o-que-vc-quer-jogar-no-jogaydev',
    ]);

    $this->get('/social/polls-preview/o-que-vc-quer-jogar-no-jogaydev')
        ->assertOk()
        ->assertSee('<meta property="og:title" content="O que vc quer jogar no JogaYdev?">', false)
        ->assertSee('vote e veja o que a comunidade gaydevs prefere 🗳️', false)
        ->assertSee('<meta property="og:url" content="https://vettoretti.dev/gaydevs/platform/polls/o-que-vc-quer-jogar-no-jogaydev">', false)
        ->assertSee('<meta name="twitter:title" content="O que vc quer jogar no JogaYdev?">', false);
});
