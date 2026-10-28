# Validação da refatoração de enquetes — #00080

## Antes de mudanças de produção

A linha de base registrada em `spec.md` foi executada em `develop` (`bc4c60e`). O primeiro commit de implementação será somente de testes e precisa permanecer verde sem mudar código de produção.

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
