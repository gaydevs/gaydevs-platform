# 00040 — Corrigir upstream herdado ao iniciar branches SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/40
Aprovada por Luciano em 20/10/2026.

## Problema

`from-issue --start` criava a branch a partir de `origin/develop`, mas herdava `origin/develop` como upstream. A branch deve nascer no mesmo commit, sem upstream, e só ganhar tracking no primeiro push.

## Aceite

- branch criada em `origin/develop` sem upstream;
- helper orienta `git push -u origin HEAD`;
- após o primeiro push, tracking é `origin/<mesma-branch>`;
- sandbox cobre a regressão sem permitir push externo;
- documentação explica o primeiro push.

## Validação

Testado com Git real: uma branch descartável nasceu com `upstream=NONE`; após `git push -u origin HEAD` para um bare remote local, passou a rastrear `origin/test/issue40-full-cycle`. A branch real da #40 apresentou o mesmo comportamento correto ao ser publicada no GitHub.
