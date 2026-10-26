# 00072 — Auto-criar diretório persistente do GeoIP

Issue: https://github.com/gaydevs/gaydevs-platform/issues/72
Tipo: Bug
Estado: fast-track aprovado.

## Objetivo

Permitir que `geoip:update` inicialize sozinho o diretório configurado em
`GEOIP_DATABASE_DIRECTORY` quando ele ainda não existe.

## Escopo

- A responsabilidade fica em `GeoIpDatabaseUpdater`, não no workflow de deploy.
- Manter o diretório externo/persistente definido pelo ambiente.
- Não alterar o agendamento nem o mecanismo de download das bases.

## Critérios de aceite

- Diretório configurado e inexistente é criado antes de lock/staging/download.
- Configuração ausente/inválida ou diretório impossível de criar/escrever falha com erro de domínio claro.
- Diretório existente continua funcionando sem alteração de comportamento.
- Teste automatizado reproduz o cenário de primeira execução sem diretório.

## Aprovação

Fast-track aprovado por um gdev antes da implementação.
