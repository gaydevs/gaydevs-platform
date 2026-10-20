# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/40 · Plano aprovado: [plan.md](plan.md)
Aprovação do plan: Luciano, 20/10/2026, aprovação explícita nesta conversa com o Cleito Bot.

## Phase 1 — Setup

- [x] T001 Confirmar em `scripts/sdd/cli.test.mjs` e `scripts/sdd/sandbox/index.mjs` o contrato atual de criação de branch, remoto bare e captura de stdout/stderr antes de editar o comportamento.

## Phase 2 — Foundational

- [x] T002 [P] Preparar a expectativa do comentário inicial e da orientação de primeiro push em `scripts/sdd/cli.test.mjs` sem alterar o contrato JSON de stdout.

## Phase 3 — US1: branch SDD nasce sem upstream e publica com tracking correto

**Goal:** iniciar uma branch no commit de `origin/develop` sem tracking e, no primeiro push seguro, associá-la à branch remota de mesmo nome.

**Independent test:** o sandbox cria a branch com `HEAD == origin/develop`, `@{upstream}` inexistente e stderr orientando `git push -u origin HEAD`; após executar esse push contra o bare remote, `@{upstream}` retorna `origin/<branch>`.

- [x] T003 [US1] Adicionar regressão de ausência de upstream e de tracking pós-primeiro-push no teste de branches em `scripts/sdd/cli.test.mjs`.
- [x] T004 [US1] Alterar a criação da branch para `git switch --no-track -c <branch> origin/develop` em `scripts/sdd/from-issue.mjs`.
- [x] T005 [US1] Preservar stdout JSON e adicionar orientação `git push -u origin HEAD` em stderr e no comentário da Issue em `scripts/sdd/from-issue.mjs`.
- [x] T006 [US1] Executar o teste direcionado de `scripts/sdd/cli.test.mjs` e ajustar somente regressões decorrentes da mudança aprovada.

## Phase 4 — Polish & cross-cutting concerns

- [x] T007 [P] Atualizar `docs/development-workflow.md` para separar criação local, primeiro push com `git push -u origin HEAD` e criação do PR.
- [x] T008 Revisar a implementação contra `spec.md`, `plan.md` e `contracts/from-issue-cli.md`, garantindo que não exista sugestão de primeiro `git push` sem `-u origin HEAD`.
- [ ] T009 Executar `node scripts/sdd/test.mjs` com timeout ampliado e exigir sucesso integral da suíte SDD. **Evidência:** 107/108 passaram; a única falha (`release-sync: falls back only for merged work PRs without merge_commit_sha in the list`) foi reproduzida isoladamente também em `origin/develop` limpo, portanto é baseline preexistente do ambiente Survivor e não regressão da #40.
- [ ] T010 Confirmar no checkout real da Issue #40 que não existe upstream antes da publicação, publicar com `git push -u origin HEAD` e verificar tracking para `origin/fix/00040-corrigir-upstream-herdado-ao-iniciar-branches-sdd`.

## Dependencies

T001 → T002 → T003 → T004 → T005 → T006 → T008 → T009 → T010.
T007 pode executar em paralelo com T003–T006, mas deve estar concluída antes de T008.

## Parallel opportunities

- T002 e a preparação documental de T007 atuam em arquivos distintos.
- T007 pode ser concluída enquanto a regressão/implementação de T003–T006 é desenvolvida.

## Implementation strategy

Implementar primeiro a regressão observável em `cli.test.mjs`, aplicar a menor mudança possível em `from-issue.mjs`, atualizar a documentação e então validar a suíte completa antes de qualquer publicação da branch.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
