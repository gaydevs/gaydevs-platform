# 00098 — Atualizar dependências do backend e frontend e corrigir alertas de segurança

Issue: https://github.com/gaydevs/gaydevs-platform/issues/98
Estado: fast-track Low Risk aprovado em 2026-11-10, condicionado a alterações compatíveis de dependências e CI verde.
Fast-track risk: Low

## Objetivo

Remover alertas conhecidos de segurança das dependências Symfony, atualizar as versões permitidas pelo Composer e npm e validar as duas aplicações.

## Escopo e restrições

- Atualizar apenas lockfiles do backend e frontend dentro dos constraints já existentes de `composer.json` e `package.json`.
- Não alterar major versions, código de negócio, autenticação, autorização, migrations ou políticas permanentes de auditoria (Issue #52).
- Auditar dependências de produção e desenvolvimento nesta validação.
- Garantir que os testes existentes das enquetes do frontend são executados por `npm test` no CI; acrescentar regressões somente se houver lacunas reais.
- Um único PR para `develop`, sem merge/deploy automático. Escalar o risco se houver incompatibilidades ou mudanças além dos lockfiles.

## Critérios de aceite

- `composer.lock` resolve a versão corrigida de `symfony/http-foundation`, `http-kernel` e `routing`, com `composer audit --locked` sem as seis vulnerabilidades observadas.
- `package-lock.json` atualizado com versões compatíveis e `npm audit` verificado (incluindo dependências dev).
- Testes, lint e build do frontend e checks CI de backend/frontend passam.
- A cobertura automatizada das enquetes permanece ativa para listagem, detalhe, votos, falhas, loading e controles de admin.
- PR contém `Refs #98`; a Issue #52 não é modificada.

## Aprovação

Solicitação de fast-track do gdev na conversa em 2026-11-10. Restrita a atualização mecânica sem mudanças de aplicação.
