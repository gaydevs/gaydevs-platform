# 00078 — Deep links de polls retornam 404 em produção

Issue: https://github.com/gaydevs/gaydevs-platform/issues/78
Estado: fast-track aprovado.

## Objetivo

Permitir acesso direto, compartilhamento e recarga das rotas client-side do frontend de enquetes sem 404 do Apache.

## Escopo

Adicionar fallback Apache no diretório publicado do frontend para servir `index.html` em rotas SPA inexistentes, preservando arquivos e diretórios reais. Garantir que o `.htaccess` chegue ao diretório final na DreamHost.

## Critérios de aceite

- `/gaydevs/platform/polls` e `/gaydevs/platform/polls/{slug}` carregam diretamente e após recarga.
- Outras rotas client-side são encaminhadas para a aplicação.
- Arquivos e diretórios reais continuam sendo servidos sem fallback.
- O artefato de build contém `.htaccess`, e o deploy falha claramente se ele não chegar ao destino temporário.

## Aprovação

Fast-track aprovado por um gdev antes da implementação.
