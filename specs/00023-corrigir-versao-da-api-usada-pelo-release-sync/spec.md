# 00023 — Corrigir versão da API usada pelo release-sync

Issue: https://github.com/gaydevs/gaydevs-platform/issues/23
Estado: rascunho — aprovação humana pendente.

## Objetivo

Restaurar a leitura de `merge_commit_sha` para que `release-sync` processe uma promoção mergeada com rastreabilidade verificável.

## Escopo

- Manter a versão atual da API GitHub.
- Se a leitura atual de um PR mergeado não trouxer `merge_commit_sha`, consultar somente esse PR com a versão compatível e usar o SHA retornado.
- Antes do commit, executar testes temporários locais contra o PR #22 para confirmar os dois cenários; não versioná-los.
- Cobrir a regressão na sandbox.
- Rerodar com segurança `release-sync 22` após a correção chegar ao código publicado, concluindo somente #16 e #20 se ainda estiverem elegíveis.

Fora de escopo: alterar regras de seleção de PRs, concluir Issues manualmente ou incluir PRs fora do release.

## Requisitos verificáveis

- REQ-001: A leitura atual de um PR mergeado permanece na API atual; se `merge_commit_sha` vier nulo, só essa leitura faz fallback compatível.
- REQ-001a: Os testes temporários confirmam os campos necessários nos dois cenários antes do commit.
- REQ-002: Ausência real de dados de rastreabilidade continua bloqueando escritas.
- REQ-003: A sandbox cobre os dois comportamentos.

## Critérios de aceite

- Dado o PR #22, quando `release-sync` for executado após a correção, então #16 e #20 são finalizadas apenas se estiverem em `Ready for Release`.
- Dado um PR sem SHA rastreável, quando o comando for executado, então ele falha sem alterar Issue ou Project.

## Dependências e questões abertas

Sem dependências nativas. A conclusão de #16 e #20 depende desta correção e de uma nova promoção para `main`.

## Aprovação humana

Aprovada por luvittor em 2026-10-14 nesta conversa, incluindo o fallback restrito.
