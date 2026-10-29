# 00083 — Tornar fast-track proporcional ao risco da Issue

Issue: https://github.com/gaydevs/gaydevs-platform/issues/83
Estado: fast-track aprovado para esta alteração de tooling.
Fast-track risk: Low

## Objetivo

Substituir a elegibilidade por tipo/trivialidade por um fast-track proporcional ao risco, aplicável aos quatro tipos SDD.

## Requisitos

- Feature, Bug, Refactor e Tech Debt podem usar fast-track.
- `--fast-track` exige classificação explícita `--risk low|medium|high`.
- `--trivial` permanece como alias legado de Low Risk.
- Low Risk exige aprovação humana inicial e segue até implementação sem gate intermediário.
- Medium Risk exige aprovação humana inicial, gera artefatos sucintos e para em Specifying até um checkpoint humano explícito.
- High Risk não entra em fast-track e deve usar o SDD normal.
- O checkpoint Medium deve ser rastreável na Issue.
- O risco pode apenas escalar durante o fast-track; a escalada pausa o trabalho em Specifying e preserva branch/spec.
- Escalada para Medium passa a exigir checkpoint; escalada para High exige retorno ao SDD normal.
- Priority continua independente de Risk.
- Review e merge continuam humanos em todos os níveis.

## Fora do escopo

- Criar campo Risk no GitHub Project/Issue.
- Alterar Team Access.
- Automatizar review ou merge.
- Alterar runtime do frontend/backend.

## Critérios de aceite

- Low, Medium e High seguem os fluxos definidos na Issue #83.
- Todos os tipos SDD são elegíveis conforme risco.
- Aprovação inicial, checkpoint Medium e escaladas geram rastreabilidade.
- Constitution, AGENTS, CONTRIBUTING e documentação refletem o modelo risk-based.
- Sandbox cobre Low em Feature, Medium com checkpoint, High recusado e escalada.

## Aprovação

Fast-track aprovado explicitamente por um gdev antes da implementação em 2026-10-28.
