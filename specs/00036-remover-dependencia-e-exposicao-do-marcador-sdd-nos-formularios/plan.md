# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/36 · Spec: [spec.md](spec.md)
Aprovação da spec: Luciano, 2026-10-20, conversa atual.

## Abordagem

- Em `scripts/sdd/core.mjs`, validar SDD apenas pelo tipo nativo suportado; o body deixa de participar da classificação.
- Remover `value`/instruções do marcador dos quatro forms SDD.
- Ajustar fixtures e testes para cobrir body com e sem marcador, mantendo falha para tipo ausente/não suportado.
- Atualizar `AGENTS.md` para criação via API exigir apenas o tipo nativo; preservar conteúdo histórico sem migração.

## Impactos e dependências

Sem API de produto, dados, migrations ou infraestrutura. Compatibilidade retroativa natural: o marcador antigo pode permanecer no body, apenas deixa de ser interpretado.

## Validação

- `node scripts/sdd/test.mjs`.
- Casos explícitos com marcador, sem marcador, sem tipo e tipo não suportado.
- Conferir forms/AGENTS e `git diff --check`.

## Constitution check

Issue #36, spec aprovada, sem blockers; implementação só após aprovação deste plan.

## Aprovação humana

Aprovado por Luciano em 2026-10-20, nesta conversa.
