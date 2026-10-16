# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/17 · Plano aprovado: [plan.md](plan.md)
Aprovação do plan: gdev `luvittor`, 2026-10-16,
https://github.com/gaydevs/gaydevs-platform/issues/17#issuecomment-6222618340

## Execução

- [x] T001 Implementar resolução segura da branch, Issue e spec e composição/validação do contrato no core SDD.
- [x] T002 Criar `pr-create.mjs` com argumentos, preflight e POST único para `develop`.
- [x] T003 Ampliar fake-gh e sandbox para criação PR e regressões de sucesso/falha e compatibilidade do check.
- [x] T004 Documentar uso, pré-condições e preservação dos gates humanos.

## Validação

- [ ] T005 Executar sandbox SDD completa e `git diff --check`; revisar todos os artefatos alterados antes de qualquer commit.

Resultado parcial: os testes focados de PR passaram (29/29) e
`git diff --check` passou. A suíte completa teve 107/108 aprovações; a única falha é a
asserção em `scripts/sdd/release-sync.test.mjs` que lê `args.at(-1)` como header,
mas recebe `--slurp`. Reproduzida também isoladamente; o arquivo ficou fora do
escopo. Revisão do gdev ainda pendente.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
