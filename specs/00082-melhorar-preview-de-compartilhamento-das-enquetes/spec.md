# 00082 — Melhorar preview de compartilhamento das enquetes

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82
Estado: fast-track aprovado.

## Objetivo

Corrigir a preview social da lista de polls e de enquetes individuais no HTML inicial entregue a crawlers.

## Escopo

- Lista: título `/gdevs/polls`, descrição definida na Issue e imagem da subseção sobre fundo azul escuro.
- Detalhe: pergunta da enquete como título, descrição definida na Issue e a mesma imagem.
- Incluir Open Graph completo pedido na Issue e Twitter Card equivalente.
- Manter o frontend como SPA estática; metadata dinâmica pertence ao backend.
- Derivar URLs públicas de `APP_FRONTEND_URL`, sem domínio/path de produção hardcoded.
- Preservar a metadata global e o comportamento normal das demais rotas.

## Critérios de aceite

Os critérios de aceite são os registrados na Issue #82.

## Aprovação

Fast-track aprovado por um gdev antes da implementação em 2026-10-28.
