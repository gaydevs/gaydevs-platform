# 00082 — Melhorar preview de compartilhamento das enquetes

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82
Estado: fluxo SDD normal após ampliação arquitetural aprovada em 2026-10-28.

## Objetivo

Corrigir a preview social da lista de polls e de enquetes individuais no HTML inicial entregue a crawlers e estabelecer um ponto único, extensível, para previews sociais das rotas da SPA.

## Escopo funcional

- Lista de polls: título `/gdevs/polls`, descrição definida na Issue e imagem da subseção sobre fundo azul escuro.
- Detalhe de poll: pergunta da enquete como título, descrição definida na Issue e a mesma imagem.
- Incluir Open Graph completo pedido na Issue e Twitter Card equivalente.
- Rotas sem preview específico devem receber a metadata global do site, em vez de exigir novas regras Apache por seção.
- Navegadores comuns continuam recebendo a SPA normalmente.

## Escopo arquitetural

- O `.htaccess` do frontend identifica apenas se o cliente é um crawler social e encaminha a rota relativa completa para um endpoint genérico do backend.
- O backend decide qual metadata corresponde à rota recebida. Nesta Issue, apenas `polls` possui resolução específica; demais rotas usam fallback global.
- Novas seções com preview próprio devem ser adicionadas no backend sem criar novas regras Apache.
- A relação de publicação atual assume frontend e API na mesma origem e em diretórios irmãos (`platform/` e `api/`). Tanto o React quanto o `.htaccess` derivam a API por `../api/`.
- `APP_FRONTEND_URL` define a base pública usada por canonical e imagens, sem domínio de produção hardcoded no código.

## Critérios de aceite

- Os critérios de metadata de polls registrados na Issue #82 continuam válidos.
- Um crawler acessando `/polls` ou `/polls/{slug}` recebe a metadata específica de polls no HTML inicial.
- Um crawler acessando outra rota da SPA recebe a metadata global pelo mesmo endpoint genérico.
- Adicionar uma futura seção de preview não exige alterar o `.htaccess`; a distinção pertence ao backend.
- Um navegador comum continua usando o fallback `index.html` da SPA.
- Não há `/gaydevs/api` nem `/gaydevs/platform` hardcoded nas regras de social preview do `.htaccess`.

## Aprovação

O fast-track inicial foi aprovado em 2026-10-28. Após a decisão de generalizar o roteamento de social previews, o escopo deixou de ser trivial; a Issue voltou a `Specifying` e a ampliação arquitetural foi explicitamente aprovada pelo gdev na mesma data antes da implementação.
