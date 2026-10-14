# 00023 — Corrigir versão da API usada pelo release-sync

Issue: https://github.com/gaydevs/gaydevs-platform/issues/23
Estado: ampliação autorizada pelo dono do repositório.

## Objetivo

Restaurar a leitura de `merge_commit_sha` para que `release-sync` processe uma promoção mergeada com rastreabilidade verificável.

## Escopo

- Manter a versão atual da API GitHub.
- Se a leitura atual de um PR mergeado não trouxer `merge_commit_sha`, consultar somente esse PR com a versão compatível e usar o SHA retornado.
- Se a listagem atual de PRs mergeados não trouxer `merge_commit_sha`, repetir somente essa listagem com a versão compatível e usar os SHAs retornados.
- Antes do commit, executar testes temporários locais contra o PR #22 para confirmar os dois cenários; não versioná-los.
- Cobrir a regressão na sandbox.
- Aceitar `--exclude-issue NUMERO` repetível para excluir, de modo explícito, referências administrativas ou históricas do release.
- Exigir que cada número excluído esteja presente no release e registrar cada exclusão no resultado.
- Executar uma nova promoção para `main` e sincronizá-la com segurança, concluindo apenas as Issues elegíveis nela entregues.

Fora de escopo: exclusões implícitas, curingas, concluir Issues manualmente ou incluir PRs fora do release.

## Requisitos verificáveis

- REQ-001: A leitura atual de um PR mergeado permanece na API atual; se `merge_commit_sha` vier nulo, só essa leitura faz fallback compatível.
- REQ-001b: A listagem atual de PRs mergeados permanece na API atual; se os SHAs necessários vierem nulos, só essa listagem faz fallback compatível.
- REQ-001a: Os testes temporários confirmam os campos necessários nos dois cenários antes do commit.
- REQ-002: Ausência real de dados de rastreabilidade continua bloqueando escritas.
- REQ-003: A sandbox cobre os dois comportamentos.
- REQ-004: `--exclude-issue` pode ser informado mais de uma vez e só exclui a Issue indicada do release atual.
- REQ-005: Uma exclusão inválida falha antes de qualquer escrita.

## Critérios de aceite

- Dado um release mergeado contendo PRs SDD, quando `release-sync` for executado após a correção, então só as Issues em `Ready for Release` entregues nesse release são finalizadas.
- Dado um PR sem SHA rastreável, quando o comando for executado, então ele falha sem alterar Issue ou Project.
- Dado o release #22 e `--exclude-issue 8`, quando o comando for executado, então a #8 é registrada como excluída e #16/#20 são processadas normalmente.

## Dependências e questões abertas

Sem dependências nativas. A conclusão de #16 e #20 depende desta correção e de uma nova promoção para `main`.

## Aprovação humana

Aprovação anterior: luvittor em 2026-10-14, incluindo exclusões explícitas e repetíveis.

Ampliação autorizada por luvittor em 2026-10-14, com um único checkpoint de revisão antes do commit.
