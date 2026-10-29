# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/83 · Spec: [spec.md](spec.md)
Fast-track risk: Low

## Abordagem

1. Remover a restrição de Feature no cálculo de identidade SDD e adicionar normalização dos níveis de risco.
2. Fazer `from-issue.mjs` exigir `--risk` no fast-track, mantendo `--trivial` como alias Low.
3. Low inicia em In Progress; Medium inicia em Specifying aguardando checkpoint; High é recusado no fast-track.
4. Adicionar `fast-track.mjs` para aprovar o checkpoint Medium e para escalar o risco sem trocar branch/spec.
5. Atualizar testes da sandbox e documentação/constitution.

## Validação

- Testes direcionados de `core.test.mjs` e `cli.test.mjs`.
- Suíte completa `node scripts/sdd/test.mjs` no fechamento.
- Inspeção do diff para garantir que runtime da plataforma não foi alterado.

## Aprovação

Fast-track aprovado por um gdev. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer no escopo de tooling SDD descrito acima.
