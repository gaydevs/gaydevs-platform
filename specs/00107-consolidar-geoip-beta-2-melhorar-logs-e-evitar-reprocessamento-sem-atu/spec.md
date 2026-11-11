# 00107 — Consolidar GeoIP v0.1.0, melhorar logs e evitar reprocessamento sem atualização

Issue: https://github.com/gaydevs/gaydevs-platform/issues/107
Fast-track: Low Risk, aprovado pelo pedido explícito do gdev antes da implementação.

## Objetivo e escopo

Atualizar a dependência GeoIP para v0.1.0 e tornar observáveis e eficientes as atualizações diárias. Manter configuração, caminhos persistentes, banco, scheduler, autenticação MaxMind e contrato externo inalterados.

## Comportamentos verificáveis

- `updated/updated` e `current/updated`: após validar City e ASN, reprocessar IPs não anonimizados.
- `current/current`: informar sucesso, sem reprocessar IPs.
- `current/current --force-reprocess`: reprocessar IPs mesmo sem atualizar bases.
- Falha/incompletude em qualquer edição: exit code 1 e nenhum reprocessamento, com ou sem flag.
- Falha de pacote: log estruturado sanitizado, sem parsing de texto ou vazamento de segredos.
- Deploy futuro usa ^0.1.0 com composer.lock versionado; testes isolados e CI.

## Restrições

Sem migrações, mudanças em secrets, diretórios de produção ou alterações na biblioteca. Revisão humana de PR e promoção para produção permanecem gates independentes.
