<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DevelopmentUserSeeder extends Seeder
{
    /** @var array<int, array{name: string, email: string, status: string}> */
    private const USERS = [
        [
            'name' => 'Alex Monteiro',
            'email' => 'alex.dev@frontend.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Bruno Santos',
            'email' => 'bruno.backend@backend.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Caio Oliveira',
            'email' => 'caio.inativo@qa.test',
            'status' => User::STATUS_INACTIVE,
        ],
        [
            'name' => 'Daniel Ferreira',
            'email' => 'daniel.cloud@cloud.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Eduardo Lima',
            'email' => 'edu.mobile@mobile.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Felipe Costa',
            'email' => 'felipe.dados@dados.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Gabriel Rocha',
            'email' => 'gabriel.sec@seguranca.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Henrique Alves',
            'email' => 'henrique.produto@produto.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'Igor Martins',
            'email' => 'igor.design@design.test',
            'status' => User::STATUS_ACTIVE,
        ],
        [
            'name' => 'João Ribeiro',
            'email' => 'joao.devops@devops.test',
            'status' => User::STATUS_ACTIVE,
        ],
    ];

    public function run(): void
    {
        if (app()->environment('production') || ! config('development.seed_enabled')) {
            return;
        }

        foreach (self::USERS as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                ['name' => $user['name'], 'status' => $user['status']],
            );
        }
    }
}
