# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/80 · Plano aprovado: [plan.md](plan.md)
Aprovação do plan: gdev `luvittor`, 2026-10-28, mensagem explícita “aprovo” nesta conversa.

## Execução

### Etapa 1 — Caracterização verde, somente testes

- [x] T001 Acrescentar em `backend/tests/Feature/PollsTest.php` um caso com três polls alterados e `since` junto de `limit=1`, verificando que os três são retornados.
- [x] T002 Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` e `composer test` em `backend/`; confirmar que o diff de código contém somente `backend/tests/Feature/PollsTest.php`.
- [x] T003 Criar o primeiro commit de código somente com `backend/tests/Feature/PollsTest.php` e conferir seu conteúdo com `git show --stat --oneline HEAD` (commit `847a12f`, um arquivo de testes).

### Etapa 2 — Leitura e payload

- [x] T004 Extrair resolução, listagem, cursores, sincronização incremental e sugestões de `backend/app/Services/PollService.php` para `backend/app/Services/Polls/PollReadService.php`, preservando `since` sem aplicar `limit`.
- [x] T005 Alterar `PollReadService` para hidratar em lote os polls e suas relações, mantendo ordem da página e do delta e removendo a resolução individual por item.
- [x] T006 Criar `backend/app/Services/Polls/PollPayloadBuilder.php` com viewer explícito, agregação dos votos em uma passagem e carregamento de `activeVotes.user` somente quando o payload autenticado expuser votantes.
- [x] T007 Atualizar `backend/app/Http/Controllers/PollController.php` e os chamadores de leitura para usar os novos componentes sem alterar rotas, envelopes, status HTTP ou middleware.
- [x] T008 Acrescentar em `backend/tests/Feature/PollsTest.php` regressões para crescimento de consultas por enquete e ausência de hidratação de usuários votantes na resposta anônima; manter os testes existentes.
- [x] T009 Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` (46 passaram, 264 assertions) e `composer test` (156 passaram, 1 skip, 936 assertions) em `backend/` após a extração de leitura e payload.

### Etapa 3 — Criação e encerramento

- [x] T010 Extrair criação para `backend/app/Actions/Polls/CreatePoll.php`, mantendo slug, validação, tentativas de colisão e transação atuais.
- [x] T011 Extrair encerramento para `backend/app/Actions/Polls/ClosePoll.php`, preservando autorização, locks, transação e auditoria atual.
- [x] T012 Migrar `backend/app/Http/Controllers/PollController.php` para as Actions e validar criação, slug, permissões e fechamento em `backend/tests/Feature/PollsTest.php`.
- [x] T013 Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` (46 passaram, 264 assertions) e `composer test` (156 passaram, 1 skip, 936 assertions) em `backend/`.

### Etapa 4 — Votação

- [x] T014 Extrair o registro, substituição e retirada de votos para `backend/app/Actions/Polls/SubmitPollResponse.php`, preservando locks, transações, opções ocultas e cancelamentos.
- [x] T015 Migrar o endpoint de resposta em `backend/app/Http/Controllers/PollController.php` e validar seleção simples/múltipla, duplicidade, substituição, retirada e enquete encerrada em `backend/tests/Feature/PollsTest.php`.
- [x] T016 Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` (46 passaram, 264 assertions), `composer test` (156 passaram, 1 skip, 936 assertions) e `php artisan test --env=mysql.testing` (157 passaram, 939 assertions) em `backend/`, usando `gaydevs_test`.

### Etapa 5 — Opções

- [x] T017 Extrair adição de opções para `backend/app/Actions/Polls/AddPollOption.php`, preservando normalização, duplicidade e autoria.
- [x] T018 Extrair ocultação/remoção de opções para `backend/app/Actions/Polls/HidePollOption.php`, preservando regras de admin, autoria, votos de terceiros e mínimo de opções.
- [x] T019 Migrar os endpoints de opções em `backend/app/Http/Controllers/PollController.php` e validar autorização, duplicidade, opções ocultas e votos em `backend/tests/Feature/PollsTest.php`.
- [x] T020 Rodar `composer lint`, `php artisan test tests/Feature/PollsTest.php` (46 passaram, 264 assertions), `composer test` (156 passaram, 1 skip, 936 assertions) e `php artisan test --env=mysql.testing` (157 passaram, 939 assertions) em `backend/`, usando a base isolada `gaydevs_test` para MySQL.

### Etapa 6 — Auditoria e remoção do legado

- [x] T021 Extrair a montagem do histórico para `backend/app/Services/Polls/PollAuditPayloadBuilder.php` e migrar o endpoint de auditoria em `backend/app/Http/Controllers/PollController.php` sem mudar eventos ou ordenação.
- [x] T022 Remover métodos e dependências obsoletos de `backend/app/Services/PollService.php`; excluir a classe quando não houver referências em `backend/app` ou `backend/tests`.
- [x] T023 Confirmar em `backend/routes/api.php` e `backend/tests/Feature/PollsTest.php` que rotas, middleware, status, payloads, autorização, ordenação, cursores, `since`, sugestões e auditoria permanecem cobertos e inalterados.

## Validação final

- [x] T024 Rodar em `backend/` `composer lint`, `composer test`, `composer test:parallel`, `composer test:random` e `php artisan test --env=mysql.testing`, registrar contagens, skip, seed e resultados comparados à linha de base em `spec.md`.
- [x] T025 Rodar `git diff --check` e revisar o diff para confirmar ausência de alterações em `backend/database/migrations/`, `backend/routes/api.php` e contratos externos.

## Dependências e estratégia

As etapas são sequenciais: caracterização → leitura/payload → criação/encerramento → votação → opções → auditoria/remoção → validação final. Não há tarefas paralelas seguras porque cada etapa migra chamadores e responsabilidades que dependem das anteriores.

MVP: Etapa 1, o commit de caracterização verde. Ela fixa primeiro o contrato de `since` com `limit` antes de qualquer alteração de produção. Os testes de desempenho e hidratação entram junto com a implementação que os satisfaz, sem commit vermelho. Nenhuma task cria Issues.
