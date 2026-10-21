# 00046 — Permitir fast-track SDD para mudanças triviais

Issue: https://github.com/gaydevs/gaydevs-platform/issues/46
Estado: spec aprovada.

## Problema e objetivo

Permitir que Bug, Refactor e Tech Debt realmente triviais possam ir de Issue até PR sem aprovações intermediárias de spec/plan, desde que um gdev autorize explicitamente o fast-track antes da implementação.

## Escopo e comportamento

- Fast-track é explícito e permitido apenas para Bug, Refactor e Tech Debt triviais.
- Feature é sempre recusada nesse modo.
- A autorização humana deve ficar registrada antes da implementação.
- Mudanças de arquitetura, autenticação/autorização, segurança/privacidade, migrations destrutivas, contratos de API ou escopo incerto não podem usar fast-track.
- Se o trabalho deixar de ser trivial, o fluxo para e volta ao SDD normal.
- Review e merge do PR continuam com os gates atuais.

## Requisitos verificáveis

- REQ-001: existir um modo explícito de iniciar fast-track e validar tipo, autorização e limites.
- REQ-002: fast-track pular spec/plan e permitir seguir até testes e PR.
- REQ-003: detectar perda de trivialidade e interromper o fast-track.
- REQ-004: constitution, documentação e sandbox cobrirem o comportamento.

## Critérios de aceite

- Uma Issue elegível e autorizada chega até PR sem novos gates intermediários.
- Feature ou Issue fora dos limites é recusada ou devolvida ao fluxo normal.
- Os gates humanos de review e merge permanecem inalterados.

## Dependências e questões abertas

Sem blockers. Nenhuma questão aberta no escopo atual.

## Aprovação humana

Aprovada por Luciano em 2026-10-20, nesta conversa.
