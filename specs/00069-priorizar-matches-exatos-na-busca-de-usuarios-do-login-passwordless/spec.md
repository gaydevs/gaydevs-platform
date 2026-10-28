# 00069 — Priorizar matches exatos na busca de usuários do login passwordless

Issue: https://github.com/gaydevs/gaydevs-platform/issues/69
Estado: fast-track aprovado.

## Objetivo

Priorizar matches exatos na busca de usuários do login passwordless.

## Escopo

Seguir estritamente a Issue, sem ampliar o escopo.

## Critérios de aceite

- A relevância segue: e-mail exato, nome inteiro exato, nome iniciado pelo termo, palavra exata posterior e demais matches atuais.
- Na busca por `Lu`, `Luciano` aparece antes de `Vagner Lu`.
- Dentro do mesmo nível de relevância, os resultados permanecem em ordem alfabética por nome.
- Filtro, máscara, limite de resultados, rate limiting e fluxo de OTP permanecem inalterados.
- A mudança permanece trivial e sem impacto fora do escopo.

## Aprovação

Fast-track aprovado por um gdev antes da implementação.
