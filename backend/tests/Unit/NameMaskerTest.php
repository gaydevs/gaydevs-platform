<?php

use App\Services\NameMasker;

test('reveals the searched prefix only in matching name parts', function () {
    $masker = app(NameMasker::class);

    expect($masker->mask('Roberto Souza', 'Ro'))
        ->toBe('Ro***** S****')
        ->and($masker->mask('Roberto Souza', 'So'))
        ->toBe('R****** So***')
        ->and($masker->mask('Roberto Souza', 'Souza'))
        ->toBe('R****** Souza')
        ->and($masker->mask('Roberto Souza', 'Roberto S'))
        ->toBe('Roberto S****')
        ->and($masker->mask('Roberto Souza', 'Roberto Souza'))
        ->toBe('Roberto Souza')
        ->and($masker->mask('Roberto Souza', 'roberto.s'))
        ->toBe('Roberto S****')
        ->and($masker->mask('Roberto Souza', 'roberto.souza'))
        ->toBe('Roberto Souza')
        ->and($masker->mask('Roberto Souza', 'roberto.souz'))
        ->toBe('Roberto Souz*');
});
