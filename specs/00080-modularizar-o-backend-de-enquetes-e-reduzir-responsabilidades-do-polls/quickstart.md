# Validação da refatoração de enquetes — #00080

## Antes de mudanças de produção

A linha de base registrada em `spec.md` foi executada em `develop` (`bc4c60e`). Para esta Issue, a entrega publicada foi aprovada como consolidada: o commit local `847a12f` contém somente testes, mas não integra a ancestralidade da PR; `843a18b` reúne o teste de caracterização e a produção. O teste continua no diff final e precisa passar junto com a suíte. Essa exceção de histórico está registrada em `spec.md`.

No diretório `backend/`:

```powershell
composer lint
php artisan test tests/Feature/PollsTest.php
composer test
```

O novo cenário deve criar mais de um poll alterado e pedir `since` com `limit=1`; o resultado continua contendo todos os polls alterados. Os testes de regressão já existentes devem continuar passando.

## Durante as extrações

Depois de cada etapa de produção:

```powershell
composer lint
php artisan test tests/Feature/PollsTest.php
composer test
```

Os testes adicionados com a melhoria de leitura devem observar que a consulta da listagem não cresce uma vez por poll/opção e que payloads anônimos não carregam a relação de votantes. Verificar também que a ordenação de opções, campos JSON e seleções permanecem iguais.

Para etapas de votação/opções que dependem de locks, usar somente a base MySQL de teste configurada em `.env.mysql.testing`:

```powershell
php artisan test --env=mysql.testing
```

Essa configuração aponta para `gaydevs_test`. Nunca executar `RefreshDatabase` contra a base de desenvolvimento.

## Validação final

Repetir exatamente a matriz da linha de base:

```powershell
composer lint
composer test
composer test:parallel
composer test:random
php artisan test --env=mysql.testing
git diff --check
```

Registrar pass/fail, assertions, skips e seed aleatório no PR. Nenhuma migration ou alteração de rota deve aparecer no diff.
