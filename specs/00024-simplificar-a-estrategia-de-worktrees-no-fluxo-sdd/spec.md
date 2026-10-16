# 00024 — Simplificar a estratégia de worktrees no fluxo SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/24
Estado: rascunho — aprovação humana pendente.

## Problema e objetivo

Evitar worktrees auxiliares quando não há trabalho simultâneo, mantendo
isolamento seguro quando houver branches ativas em paralelo.

## Escopo e comportamento

- Um único trabalho usa o checkout existente; não cria worktree extra.
- Trabalho simultâneo em branches diferentes usa worktrees separados.
- A documentação orienta a retomar branch/spec existentes e a limpar worktrees
  após merge ou abandono, sem descartar alterações locais.

Fora de escopo: alterar o contrato SDD, alterar os helpers de criação de
Issue/spec, remover worktrees automaticamente, descartar alterações locais, ou
modificar a estratégia Git de merge/release.

## Requisitos verificáveis

- REQ-001: A documentação define quando criar worktree: somente para trabalho
  simultâneo que exige checkout separado.
- REQ-002: A documentação prevê retomada e limpeza segura, sem automação de
  remoção nem descarte de alterações.

## Critérios de aceite

- Dado um único trabalho, quando o gdev iniciar a Issue, então usa o checkout
  atual sem worktree auxiliar.
- Dado trabalho simultâneo, quando for necessário outro checkout, então usa um
  worktree separado.
- Dado worktree integrado ou abandonado, quando houver limpeza, então alterações
  locais são preservadas ou tratadas antes da remoção.

## Dependências e questões abertas

Não há blockers nem Issues bloqueadas na consulta de 2026-10-16. O plan definirá
os documentos a atualizar; helpers e automação de limpeza seguem fora do escopo.

## Aprovação humana

Aprovada por luvittor em 2026-10-16, nesta conversa.
