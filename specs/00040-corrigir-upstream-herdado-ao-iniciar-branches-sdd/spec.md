# 00040 — Corrigir upstream herdado ao iniciar branches SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/40
Estado: rascunho — aprovação humana pendente.

## Problema e objetivo

Ao iniciar uma Issue pelo fluxo SDD, a branch de trabalho é criada corretamente a partir de `origin/develop`, porém passa a rastrear `origin/develop` como upstream. Isso faz o estado local ser comparado com a branch base e torna um `git push` sem destino inadequado para a primeira publicação da branch.

O objetivo é preservar `origin/develop` apenas como ponto de partida: a branch SDD deve nascer sem upstream e só passar a rastrear sua branch remota de mesmo nome quando for publicada pela primeira vez.

A reprodução da Issue #40 confirmou o comportamento atual: `fix/00040-corrigir-upstream-herdado-ao-iniciar-branches-sdd` nasceu no mesmo commit de `origin/develop`, mas com upstream `origin/develop`.

## Escopo e comportamento

- O início do SDD continua usando o estado atualizado de `origin/develop` como base.
- A nova branch local deve ficar sem upstream enquanto ainda não tiver sido publicada.
- O fluxo deve orientar explicitamente que a primeira publicação seja feita com `git push -u origin HEAD`.
- Depois dessa publicação, a branch local deve rastrear `origin/<mesmo-nome-da-branch>`.
- O comportamento deve valer para todos os tipos de Issue que usam a criação de branch do `from-issue --start`.
- A documentação do fluxo de desenvolvimento deve distinguir criação local de primeira publicação e não sugerir que um `git push` sem destino publique uma branch ainda sem upstream.
- O fluxo existente de nomenclatura de branches, criação de artefatos SDD e movimentação da Issue no Project deve permanecer inalterado.

Fora do escopo:

- alterar a branch base `develop`;
- alterar regras de proteção de branches no GitHub;
- alterar a convenção de nomes das branches SDD;
- automatizar a publicação da branch durante `from-issue --start`.

## Requisitos verificáveis

- REQ-001: `from-issue --start` deve criar a branch no mesmo commit de `origin/develop` sem configurar upstream.
- REQ-002: antes da primeira publicação, a consulta ao upstream da branch recém-criada deve indicar que nenhum upstream está configurado.
- REQ-003: o helper deve informar de forma clara, sem quebrar sua saída estruturada, que a primeira publicação usa `git push -u origin HEAD`.
- REQ-004: após `git push -u origin HEAD`, a branch local deve rastrear `origin/<mesmo-nome-da-branch>`.
- REQ-005: a sandbox SDD deve possuir regressão automatizada que verifique a ausência de upstream após a criação e o upstream correto após a primeira publicação.
- REQ-006: a documentação para gdevs deve explicar a primeira publicação e não apresentar `git push` sem destino como forma de publicar uma branch inédita.
- REQ-007: a suíte `node scripts/sdd/test.mjs` deve continuar passando.
- REQ-008: os efeitos existentes do início do SDD — branch naming, artefatos esperados, comentário na Issue e status no Project — devem continuar funcionando.

## Critérios de aceite

- Dado uma Issue válida e sem blockers, quando `from-issue --start` cria sua branch, então o HEAD é o mesmo de `origin/develop` e a branch não possui upstream.
- Dado uma branch SDD recém-criada e ainda não publicada, quando o gdev consulta a orientação do helper, então encontra explicitamente `git push -u origin HEAD` como primeiro push.
- Dado uma branch sem upstream, quando o gdev executa `git push -u origin HEAD`, então a branch remota de mesmo nome é criada e passa a ser o upstream local.
- Dado o sandbox de regressão SDD, quando os testes de criação de branches são executados, então uma regressão que volte a herdar `origin/develop` como upstream é detectada.
- Dado o guia de desenvolvimento, quando um gdev consulta o fluxo de publicação, então fica explícita a diferença entre criar a branch local, fazer o primeiro push e criar o PR.
- Dado o conjunto completo de testes SDD, quando `node scripts/sdd/test.mjs` é executado após a correção, então a suíte conclui com sucesso.

## Dependências e questões abertas

- A Issue #40 não possui blockers registrados no SDD.
- Não há dependência funcional externa identificada para a correção.
- A implementação deve preservar a saída JSON consumida pelas automações e testes existentes.

## Aprovação humana

Aprovada por Luciano em 20/10/2026. Referência: aprovação explícita nesta conversa com o Cleito Bot.
