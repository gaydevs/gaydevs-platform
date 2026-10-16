# 00017 — Automatizar criação de PR SDD com referências obrigatórias

Issue: https://github.com/gaydevs/gaydevs-platform/issues/17
Estado: spec e plan aprovados — execução autorizada.

## Problema e objetivo

O contrato SDD já valida PRs de trabalho para `develop`, mas sua abertura ainda
depende de compor manualmente as referências à Issue e à spec. O objetivo é
oferecer um comando versionado que crie esses PRs com as referências exigidas,
reduzindo erro operacional sem modificar os gates humanos existentes.

## Escopo e comportamento

- O comando opera a partir de uma branch SDD atual válida e identifica uma única
  Issue pelo ID presente no nome da branch.
- O comando cria um PR de trabalho cujo destino é `develop` e cujo corpo inclui
  exatamente `Refs #ID` para a Issue identificada.
- Quando houver uma única pasta `specs/NNNNN-*` correspondente à mesma Issue, o
  corpo inclui também `Spec: NNNNN`.
- O gdev pode fornecer um título e texto adicional; o comando preserva esses
  dados sem permitir que substituam ou removam as referências obrigatórias.
- O comando falha sem criar PR quando a branch não for SDD válida, não houver
  identificação inequívoca da Issue, ou a spec correspondente for ausente ou
  ambígua nos casos em que ela for exigida.
- PRs abertos manualmente continuam permitidos e sujeitos ao check de contrato
  já existente.

Fora de escopo: alterar o check `SDD PR contract`, inferir contexto por título
ou nome parecido de branch, aprovar/revisar/mergear PRs, sincronizar Status do
Project automaticamente, ou criar Issues a partir de tasks.

## Requisitos verificáveis

- REQ-001: Existe um comando SDD versionado que cria PR de trabalho para
  `develop` a partir da branch SDD atual.
- REQ-002: Todo PR criado pelo comando contém uma única referência `Refs #ID`
  correspondente ao ID resolvido pela branch.
- REQ-003: Quando houver spec correspondente, todo PR criado pelo comando
  contém `Spec: NNNNN` do mesmo ID.
- REQ-004: O comando aceita título e conteúdo adicional sem invalidar as
  referências SDD obrigatórias.
- REQ-005: Falhas de branch, Issue ou spec ausente/ambígua são claras e não
  resultam na criação parcial de PR.
- REQ-006: A sandbox cobre criação válida, os principais erros de resolução e a
  preservação dos gates humanos; PR manual continua compatível com o check.
- REQ-007: A documentação permanente explica quando usar o comando e explicita
  que review e merge permanecem ações humanas.

## Critérios de aceite

- Dada uma branch SDD válida para a Issue 17 com spec correspondente, quando o
  gdev executar o comando, então é criado um PR para `develop` com `Refs #17`
  e `Spec: 00017`.
- Dada uma branch válida sem spec aplicável, quando o comando for executado,
  então o PR inclui `Refs #ID` e não inclui uma referência de spec incorreta.
- Dada uma branch inválida, uma Issue não resolvida ou specs ambíguas, quando o
  comando for executado, então recebe erro claro e nenhum PR é criado.
- Dado título e texto adicional fornecidos, quando o PR for criado, então ambos
  são preservados junto das referências SDD exigidas.
- Dado um PR criado pelo comando, quando o check `SDD PR contract` for
  executado, então ele é aprovado pelo contrato.

## Dependências e decisões encaminhadas ao plan

A Issue #16 é registrada como blocker, mas está fechada como concluída na
consulta de 2026-10-16; não há blocker aberto. A #17 não bloqueia outra Issue.

O nome/interface do comando, a entrada para título/texto adicional e o
tratamento de uma Issue sem spec estão definidos no `plan.md`. São decisões
técnicas dentro do escopo aprovado nesta spec.

## Aprovação humana

Aprovada pelo gdev `luvittor` em 2026-10-16.
Referência: https://github.com/gaydevs/gaydevs-platform/issues/17#issuecomment-6222425865
