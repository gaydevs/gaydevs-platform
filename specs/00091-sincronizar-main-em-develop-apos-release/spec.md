# 00091 — Sincronizar main em develop após release

Issue: https://github.com/gaydevs/gaydevs-platform/issues/91
Estado: fast-track Medium Risk aguardando checkpoint humano.
Fast-track risk: Medium

## Objetivo

Sincronizar main em develop após release.

## Escopo

Seguir estritamente a Issue, sem ampliar o escopo.

## Critérios de aceite

- O resultado pedido na Issue é atendido.
- O risco permanece no nível registrado ou é escalado antes de continuar.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Um checkpoint humano adicional é obrigatório antes da implementação.


## Decisão técnica

Após validar uma release mergeada, `release-sync` deve mesclar o `merge_commit_sha` exato da release em `develop` via GitHub Merge API antes de finalizar Issues. O merge preserva commits novos de `develop`; não usar reset/force-push.
