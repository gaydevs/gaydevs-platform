# 00020 — Validar E2E controlado das transições assistidas do SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/20
Estado: rascunho — aprovação humana pendente.

## Problema e objetivo

A infraestrutura SDD já valida seus comandos em sandbox, mas ainda não possui
uma evidência controlada no GitHub real para todo o ciclo de uma Issue técnica:
PR de trabalho, sincronização no Project, promoção de release e encerramento
como `completed`. A Issue #20 existe exclusivamente como essa fixture e não
representa uma entrega de produto.

O objetivo é comprovar, com links e estados remotos verificáveis, que os
comandos assistidos respeitam os gates humanos e realizam somente as transições
previstas.

## Escopo e comportamento

1. A fixture usa uma branch `techdebt/00020-*` derivada de `develop` e mantém
   uma única pasta `specs/00020-*`.
2. A implementação da fixture é limitada aos artefatos SDD necessários para
   sua rastreabilidade; ela não altera comportamento de frontend ou backend.
3. O PR de trabalho aponta para `develop`, contém exatamente `Refs #20` e
   `Spec: 00020`, e passa o check `SDD PR contract`.
4. Com o PR aberto e a Issue em `In Progress`, um gdev executa
   `pr-sync.mjs` para transitar a Issue a `Review`. Review e merge continuam
   ações humanas.
5. Após merge commit do PR em `develop`, um gdev executa `pr-sync.mjs` de novo
   para transitar a Issue de `Review` para `Ready for Release`, mantendo-a
   aberta.
6. Um PR de release separado, `develop` para `main`, não lista a Issue no body.
   Depois de sua aprovação administrativa e merge commit, `release-sync.mjs`
   descobre a fixture pelo `merge_commit_sha` do PR de trabalho, marca-a `Done`
   e a fecha com motivo `completed`.
7. A evidência de cada passo fica no checklist local de E2E; não se arrastam
   cards manualmente para simular transições e não se automatiza review,
   aprovação ou merge.

Fora de escopo: mudanças funcionais de produto, uso das Issues #17 ou #19 como
fixture, criação automática de PR, alteração da política de merge ou execução
de deploy como requisito de `Done`.

## Requisitos verificáveis

- REQ-001: A branch da fixture e a pasta de spec usam o ID `00020` e derivam
  de `develop`.
- REQ-002: O PR de trabalho contém `Refs #20` e `Spec: 00020`, aponta para
  `develop` e seu check `SDD PR contract` conclui com sucesso.
- REQ-003: A execução de `pr-sync.mjs` enquanto o PR está aberto move somente
  `In Progress` para `Review`; não aprova, não faz merge e não fecha a Issue.
- REQ-004: Após o merge commit do PR de trabalho em `develop`, nova execução de
  `pr-sync.mjs` move somente `Review` para `Ready for Release`, mantendo a
  Issue aberta.
- REQ-005: O PR de release `develop` para `main` pode ter body vazio e,
  depois de mergeado, `release-sync.mjs` encontra a Issue #20 pelo
  `merge_commit_sha` do PR de trabalho, sem deduzi-la do body da release.
- REQ-006: `release-sync.mjs` move a Issue #20 de `Ready for Release` para
  `Done` e a fecha com `state_reason: completed`.
- REQ-007: A fixture não introduz mudanças funcionais em `frontend/` ou
  `backend/`.

## Critérios de aceite

- Dado o PR de trabalho aberto e a Issue #20 em `In Progress`, quando
  `pr-sync.mjs` é executado, então o Project mostra `Review` e a Issue continua
  aberta.
- Dado o mesmo PR mergeado por merge commit em `develop`, quando `pr-sync.mjs`
  é executado, então o Project mostra `Ready for Release` e a Issue continua
  aberta.
- Dado o PR de release `develop` para `main` mergeado por merge commit, quando
  `release-sync.mjs` é executado, então a Issue #20 fica `Done`, fechada como
  `completed`, e o checklist aponta para o PR de trabalho e seu
  `merge_commit_sha`.
- Dado a revisão do diff da fixture, quando ela é conferida antes do PR, então
  não há mudança funcional em `frontend/` ou `backend/`.

## Dependências e questões abertas

Não há blockers nem dependências nativas abertas na criação desta spec.

Questão operacional: os dois comandos `pr-sync.mjs` precisam ser executados em
momentos distintos — antes da review/merge humana e depois do merge em
`develop`. O checklist local registra ambas as evidências.

## Aprovação humana

Aprovada por gdev `luvittor` em 2026-10-14:
https://github.com/gaydevs/gaydevs-platform/issues/20#issuecomment-6175367492
