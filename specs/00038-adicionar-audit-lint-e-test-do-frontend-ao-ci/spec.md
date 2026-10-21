# 00038 — Adicionar audit, lint e test do frontend ao CI

Issue: https://github.com/gaydevs/gaydevs-platform/issues/38
Estado: APROVADA por gdev em 2026-10-20.

## Problema e objetivo

Validar o frontend antes do deploy, com checks equivalentes aos já preparados
para o backend, para que problemas de qualidade, dependências ou testes apareçam
no push/PR e possam bloquear o merge.

## Escopo e comportamento

- Criar checks separados de lint, audit e test para o frontend em todo push.
- Lint também executa typecheck e check:content.
- Audit verifica dependências de produção no push e semanalmente.
- Se `frontend/package.json` não existir, o check passa sem executar, como no backend.
- Configurar infraestrutura inicial de testes e executá-la no CI.
- Tornar os checks obrigatórios em `develop` e `main` após existirem no GitHub.
- Remover do deploy apenas o lint que ficar duplicado.
- Fora de escopo: E2E e outras mudanças no deploy.

## Requisitos verificáveis

- REQ-001: Todo push produz checks de lint, audit e test do frontend.
- REQ-002: O lint executa `lint`, `typecheck` e `check:content`.
- REQ-003: O audit cobre dependências de produção e também roda semanalmente.
- REQ-004: Ausência de `frontend/package.json` não faz o workflow falhar.
- REQ-005: Falha de check obrigatório impede merge nas branches protegidas.
- REQ-006: O deploy do frontend continua funcional sem lint duplicado.

## Critérios de aceite

- Em um PR com frontend presente, lint, typecheck, content, audit e test são executados e exibidos como checks.
- Uma falha em check obrigatório bloqueia o merge em `develop`.
- Sem `frontend/package.json`, os workflows concluem sem erro.
- O deploy para `main` continua funcionando.

## Dependências e questões abertas

Sem blockers na Issue. A escolha do runner e do primeiro teste fica para o plan.

## Aprovação humana

Aprovada por Luciano Vettoretti em 2026-10-20, nesta sessão.


## Delta aprovado — 2026-10-20

- Incluir exatamente 2 testes simples do frontend para `ActionLink`: link externo seguro e link interno sem nova aba.
- Solicitação/aprovação explícita: Luciano Vettoretti, nesta sessão.
