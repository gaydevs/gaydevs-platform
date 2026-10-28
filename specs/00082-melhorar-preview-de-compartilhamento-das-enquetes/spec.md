# 00082 — Melhorar preview de compartilhamento das enquetes

Issue: https://github.com/gaydevs/gaydevs-platform/issues/82
Estado: fluxo SDD normal após ampliação arquitetural aprovada em 2026-10-28.

## Objetivo

Corrigir a preview social da lista de polls e de enquetes individuais no HTML inicial entregue a crawlers e estabelecer um ponto único, extensível, para previews sociais das rotas da SPA.

## Escopo funcional

- Lista de polls: título `/gdevs/polls`, descrição definida na Issue e imagem da subseção sobre fundo azul escuro.
- Detalhe de poll: pergunta da enquete como título, descrição definida na Issue e a mesma imagem.
- Incluir Open Graph completo pedido na Issue e Twitter Card equivalente.
- A resolução de preview segue fallback hierárquico: recurso específico → área conhecida → metadata global da plataforma.
- Navegadores comuns continuam recebendo a SPA normalmente.

## Escopo arquitetural

- O `.htaccess` do frontend identifica apenas se o cliente é um crawler social e encaminha a rota relativa completa para um endpoint genérico do backend.
- O backend decide qual metadata corresponde à rota recebida. Nesta Issue, `polls` é uma área conhecida: um slug existente recebe preview do recurso; slug ausente ou subrota não reconhecida recebe o preview da área; áreas desconhecidas recebem fallback global.
- Novas seções com preview próprio devem ser adicionadas no backend sem criar novas regras Apache.
- A relação de publicação atual assume frontend e API na mesma origem e em diretórios irmãos (`platform/` e `api/`). Tanto o React quanto o `.htaccess` derivam a API por `../api/`.
- `APP_FRONTEND_URL` define a base pública usada por canonical e imagens, sem domínio de produção hardcoded no código.

## Critérios de aceite

- Os critérios de metadata de polls registrados na Issue #82 continuam válidos.
- Um crawler acessando `/polls` recebe a metadata da área; `/polls/{slug}` recebe a metadata específica da enquete quando o slug existe.
- Um crawler acessando uma rota não reconhecida dentro de `polls` recebe a metadata da área de polls; uma rota de área desconhecida recebe a metadata global pelo mesmo endpoint genérico.
- Adicionar uma futura seção de preview não exige alterar o `.htaccess`; a distinção pertence ao backend.
- Um navegador comum continua usando o fallback `index.html` da SPA.
- Não há `/gaydevs/api` nem `/gaydevs/platform` hardcoded nas regras de social preview do `.htaccess`.

## Aprovação

O fast-track inicial foi aprovado em 2026-10-28. Após a decisão de generalizar o roteamento de social previews, o escopo deixou de ser trivial; a Issue voltou a `Specifying` e a ampliação arquitetural foi explicitamente aprovada pelo gdev na mesma data antes da implementação.
