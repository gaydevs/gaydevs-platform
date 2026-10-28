# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/83 · Plano: [plan.md](plan.md)

- [x] T001 Adaptar identidade e parsing do fast-track para Risk Low/Medium/High.
- [x] T002 Implementar checkpoint Medium e escalada de risco preservando branch/spec.
- [x] T003 Atualizar sandbox para os novos gates e fluxos.
- [x] T004 Atualizar constitution, AGENTS, CONTRIBUTING e documentação SDD.
- [x] T005 Rodar testes direcionados e suíte SDD completa.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.


## Validação

- `core.test.mjs`: 7/7 passando.
- Cenários risk-based direcionados: Low/Medium/High e `--trivial` passando.
- Regressão do fluxo normal de `from-issue`: 4/4 passando após preservar a mensagem existente.
- Suíte SDD completa executada: quatro regressões desta Issue foram identificadas e corrigidas; a única falha restante é `release-sync: falls back only for merged work PRs without merge_commit_sha in the list`, reproduzida sem alterações em `origin/develop` e portanto fora do escopo da #83.
