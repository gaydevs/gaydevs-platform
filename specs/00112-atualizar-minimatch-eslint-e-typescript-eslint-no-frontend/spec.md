# 00112 — Atualizar minimatch, eslint e typescript-eslint no frontend

Issue: https://github.com/gaydevs/gaydevs-platform/issues/112
Estado: fast-track Medium Risk com checkpoint humano aprovado.
Fast-track risk: Medium

## Objetivo e escopo

Eliminar a versão vulnerável de minimatch no frontend, atualizando coordenadamente as dependências de lint. O lockfile de develop em 631dc49 contém minimatch 10.2.6, exclusivamente de desenvolvimento, consumido por eslint, @eslint/config-array e @typescript-eslint/typescript-estree. Não há alteração funcional prevista na aplicação nem no backend.

## Critérios de aceite

- Resolver minimatch em 11.0.9 (ou versão corrigida mais recente compatível), eslint em 10.15.0 e typescript-eslint em 8.73.0 ou versões compatíveis justificadas.
- Verificar CVE-2026-118764 e GHSA-cf2h-pxjq-68xw, incluindo alcance das dependências e ausência das versões vulneráveis no lockfile final.
- Manter package.json e package-lock.json consistentes; npm ci, lint, testes, typecheck e build devem passar.
- Não alterar dependências não relacionadas sem justificativa nem introduzir mudanças em código da aplicação.
- Abrir PR para develop com Refs #112 e Spec: 00112; preservar gates humanos de review e merge.

## Aprovação

Fast-track Medium Risk aprovado explicitamente pelo gdev solicitante em 2026-11-27, nesta conversa: "Aprovo o Fast Track medium risk para a Issue #112. Prossiga." A aprovação inicial não cobre o checkpoint adicional. Se houver necessidade de mudanças de maior impacto ou escopo incerto, pausar e reavaliar o risco.

Checkpoint humano aprovado em 2026-11-27 nesta conversa, incluindo spec, plan e tasks; registro remoto pelo script oficial SDD.
