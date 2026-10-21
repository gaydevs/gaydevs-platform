<?php

use App\Services\NameMasker;

test('reveals the searched prefix only in matching name parts', function () {
    $masker = app(NameMasker::class);

    expect($masker->mask('Luciano Vettoretti', 'Lu'))
        ->toBe('Lu***** V*********')
        ->and($masker->mask('Luciano Vettoretti', 'Ve'))
        ->toBe('L****** Ve********')
        ->and($masker->mask('Luciano Vettoretti', 'Vettoretti'))
        ->toBe('L****** Vettoretti')
        ->and($masker->mask('Luciano Vettoretti', 'Luciano V'))
        ->toBe('Luciano V*********')
        ->and($masker->mask('Luciano Vettoretti', 'Luciano Vettoretti'))
        ->toBe('Luciano Vettoretti')
        ->and($masker->mask('Luciano Vettoretti', 'luciano.v'))
        ->toBe('Luciano V*********')
        ->and($masker->mask('Luciano Vettoretti', 'luciano.vettoretti'))
        ->toBe('Luciano Vettoretti')
        ->and($masker->mask('Luciano Vettoretti', 'luciano.vett'))
        ->toBe('Luciano Vett******');
});
