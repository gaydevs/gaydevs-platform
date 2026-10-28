# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/72 · Spec: [spec.md](spec.md)

## Abordagem

- Centralizar no `GeoIpDatabaseUpdater` a resolução/preparação de `geoip.database_directory`.
- Validar configuração não vazia e caminho absoluto.
- Criar recursivamente o diretório ausente com modo solicitado `0750` e validar que ele é diretório gravável.
- Manter lock, staging, validação e instalação das bases inalterados.
- Atualizar a documentação para explicitar que não há preparação manual da pasta.

## Validação

Executar os testes unitários de GeoIP, `git diff --check` e conferir o diff final.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.
