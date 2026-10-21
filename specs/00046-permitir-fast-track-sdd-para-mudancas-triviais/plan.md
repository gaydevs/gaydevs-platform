# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/46 · Spec: [spec.md](spec.md)
Aprovação da spec: Luciano, 2026-10-20, conversa com o agente e registro na Issue.

## Abordagem

- Reaproveitar o fluxo atual de trabalho trivial (`--trivial`) e formalizá-lo como fast-track.
- Adicionar `--fast-track` como opção explícita; ao iniciar, exigir também `--human-approved`. Manter `--trivial` como alias compatível, sujeito ao mesmo gate.
- Fast-track cria branch, gera spec/plan/tasks sucintos, move para In Progress e registra na Issue o modo e a declaração de aprovação humana.
- Feature continua recusada. AGENTS/constitution/workflow passam a listar os limites da Issue #46 e obrigar o agente a abandonar fast-track e voltar ao SDD normal se o escopo crescer.
- Não alterar o contrato de PR/review/merge.

## Impactos e dependências

Somente tooling/documentação SDD. Sem API de produto, dados, migrations ou infraestrutura. Sem blockers.

## Validação

Sandbox cobre: Feature recusada; ausência de aprovação recusada; Bug/Refactor/Tech Debt aceitos; spec/plan/tasks sucintos gerados; comentário/status corretos; compatibilidade do alias; PR rastreável com spec.

## Constitution check

A mudança altera a própria governança de gates, portanto constitution e documentação serão atualizadas explicitamente. Review/merge humanos permanecem intactos.

## Aprovação humana

Aprovado por Luciano em 2026-10-20, nesta conversa.
