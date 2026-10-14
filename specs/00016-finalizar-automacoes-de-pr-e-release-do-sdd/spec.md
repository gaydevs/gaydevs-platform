# 00016 — Finalizar automações de PR e release do SDD

Issue: https://github.com/gaydevs/gaydevs-platform/issues/16
Estado: spec aprovada no gate humano em 2026-10-01.

## Problema e objetivo

A infraestrutura SDD ja cria Issues rastreaveis, branch/spec a partir da Issue,
Project com Status, Priority e encerramentos Not planned para Rejected/Canceled.
O ciclo final ainda depende de acoes manuais para refletir PRs e releases no
Project e para encerrar Issues entregues, deixando incerto quando um trabalho
passou de Review para Ready for Release e quando esta realmente Done.

O objetivo desta Tech Debt e definir o comportamento esperado para as automacoes
finais de PR e release do SDD: PR de trabalho para `develop`, PR `develop` ->
`main`, identificacao das Issues entregues, transicoes finais de Status e
fechamento correto das Issues. A spec cobre o que deve acontecer e os criterios
verificaveis; escolhas de arquitetura, eventos, permissoes, tokens, scripts e
workflows pertencem ao `plan.md`.

## Escopo e comportamento

Dentro do escopo:

- PR de trabalho aberto para `develop` deve colocar a Issue SDD relacionada em
  `Review`, sem conceder ou substituir o gate humano de review.
- PR de trabalho fechado sem merge deve devolver a Issue relacionada de `Review`
  para `In Progress`, exceto quando a Issue ja estiver em estado terminal.
- PR de trabalho mergeado em `develop` deve colocar a Issue SDD relacionada em
  `Ready for Release`, mantendo a Issue aberta.
- A Issue deve permanecer em `Ready for Release` ate fazer parte de um PR
  `develop` -> `main` efetivamente mergeado.
- PR `develop` -> `main` fechado sem merge nao deve alterar Status, fechar Issue
  nem produzir `Done`.
- O merge valido do PR `develop` -> `main` e o evento que leva as Issues
  entregues para `Done` e as fecha como completed.
- Sucesso de deploy nao e pre-requisito para `Done` nesta fase. Deploy continua
  sendo uma preocupacao operacional separada; falha posterior de deploy nao desfaz
  automaticamente `Done` nem reabre Issue.
- Nem todo merge em `main` dispara o workflow atual de deploy: ele so roda quando
  ha alteracao em `frontend/**` ou `.github/workflows/deploy.yml`, alem de
  `workflow_dispatch`.
- Releases podem conter multiplas Issues; cada Issue deve ser atualizada uma vez,
  de forma rastreavel, e falhas parciais precisam ser detectaveis.
- Todo PR de trabalho para `develop` deve conter `Refs #ID`. Para trabalho com
  spec, deve conter tambem `Spec: NNNNN`, correspondente a mesma Issue.
- `Refs #ID` e a referencia canonica usada para relacionar o PR de trabalho a
  Issue. No fluxo normal, o agente/script que cria o PR deve preencher essas
  referencias automaticamente; se o PR for criado manualmente, o gdev precisa
  fornece-las.
- O PR `develop` -> `main` nao precisa listar manualmente todos os `Refs #ID` no
  corpo, mas o processo deve conseguir determinar de forma confiavel quais Issues
  rastreadas em PRs de trabalho ja integrados em `develop` pertencem ao release.
  A forma tecnica dessa descoberta pertence ao `plan.md`.
- A automacao nao deve identificar Issue por titulo parecido, branch aproximada
  ou texto livre.
- O processamento dos eventos de PR/release deve ser idempotente: reprocessar o
  mesmo evento nao pode duplicar efeitos, corromper Status ou produzir fechamento
  incorreto.
- `Rejected` e `Canceled` continuam sendo encerramentos Not planned e nao devem
  ser tratados como `Done` nem como entrega em producao.
- Gates humanos continuam obrigatorios: aprovacao da spec antes do plan,
  aprovacao do plan antes das tasks/codigo, review para PR em `develop` e
  aprovacao/merge administrativo para `main`.
- A automacao nao deve executar codigo nao confiavel de PR com credenciais
  privilegiadas.
- A cobertura deve ser reproduzivel na sandbox SDD, com Git/PowerShell reais,
  GitHub simulado obrigatorio e zero writes reais no GitHub.
- A validacao E2E final deve usar fixture tecnica controlada, nao uma Feature de
  produto real.
- O plano histórico so deve ser removido ao final, depois que informacoes ainda
  necessarias tiverem sido migradas para documentacao permanente.
- Frontend e backend nao devem receber mudancas funcionais desnecessarias para
  esta infraestrutura.

Fora do escopo:

- Criar ou entregar uma Feature de produto real.
- Alterar comportamento funcional de `frontend/` ou `backend/` sem necessidade
  direta para a infraestrutura SDD.
- Automatizar aprovacao de spec, aprovacao de plan, review humano, aprovacao
  administrativa, merge de PR ou release.
- Definir no `spec.md` a arquitetura de GitHub Actions, scripts, eventos,
  permissoes, tokens ou detalhes de implementacao.

## Requisitos verificáveis

- REQ-001: Ao abrir um PR de trabalho para `develop` com rastreabilidade SDD
  valida, a Issue SDD relacionada deve ficar com Status `Review`.
- REQ-002: A transicao para `Review` nao deve fechar a Issue, nao deve marcar
  `Done` e nao deve dispensar o review obrigatorio de outro gdev.
- REQ-003: Se um PR de trabalho para `develop` for fechado sem merge enquanto a
  Issue relacionada estiver em `Review`, a Issue deve voltar para `In Progress`.
- REQ-004: Fechar um PR de trabalho sem merge nao deve reabrir nem reclassificar
  Issues que ja estejam em estado terminal.
- REQ-005: Ao mergear em `develop` um PR de trabalho rastreado, a Issue SDD
  relacionada deve ficar com Status `Ready for Release`.
- REQ-006: Um merge em `develop` jamais deve fechar a Issue relacionada.
- REQ-007: A Issue deve permanecer em `Ready for Release` ate fazer parte de um
  PR `develop` -> `main` efetivamente mergeado.
- REQ-008: PR `develop` -> `main` fechado sem merge nao deve alterar Status de
  Issues, fechar Issues nem produzir `Done`.
- REQ-009: O merge valido do PR `develop` -> `main` deve mover as Issues
  entregues para `Done` e fecha-las como completed.
- REQ-010: Um release deve aceitar multiplas Issues e aplicar a conclusao a cada
  Issue elegivel sem depender de uma relacao um-PR-uma-Issue.
- REQ-011: Sucesso de deploy nao deve ser requisito para `Done` nesta fase, e
  falha posterior de deploy nao deve desfazer automaticamente `Done` nem reabrir
  Issue.
- REQ-012: A documentacao e os criterios devem preservar a observacao de que nem
  todo merge em `main` dispara o workflow atual de deploy.
- REQ-013: Issues em `Rejected` ou `Canceled` devem permanecer encerramentos Not
  planned e nao podem ser reclassificadas como entrega concluida por automacao de
  release.
- REQ-014: Todo PR de trabalho para `develop` deve conter `Refs #ID`; para
  trabalho com spec, deve conter tambem `Spec: NNNNN` correspondente a mesma
  Issue.
- REQ-015: `Refs #ID` deve ser a referencia canonica para relacionar PR de
  trabalho e Issue.
- REQ-016: No fluxo normal, o agente/script que cria o PR deve preencher as
  referencias obrigatorias; se o PR for criado manualmente, o gdev deve
  fornece-las.
- REQ-017: O PR `develop` -> `main` nao deve exigir listagem manual de todos os
  `Refs #ID`, mas o processo deve determinar de forma confiavel quais Issues de
  PRs de trabalho ja integrados em `develop` pertencem ao release.
- REQ-018: A automacao deve recusar ou sinalizar PR/release sem rastreabilidade
  SDD suficiente, em vez de identificar Issues por titulo parecido, branch
  aproximada ou texto livre.
- REQ-019: O processamento de eventos de PR/release deve ser idempotente:
  reprocessar o mesmo evento nao pode duplicar efeitos, corromper Status nem
  produzir fechamento incorreto.
- REQ-020: A automacao deve preservar os gates humanos existentes e nunca
  registrar aprovacao humana sem evidencia fornecida por um gdev.
- REQ-021: A automacao deve operar sem executar codigo nao confiavel de PR com
  credenciais privilegiadas.
- REQ-022: A sandbox SDD deve cobrir as transicoes `Review`, `Ready for Release`,
  `Done` e os casos de erro relevantes sem usar rede nem escrever no GitHub real.
- REQ-023: A validacao E2E final deve usar fixture tecnica controlada e
  descartavel, com rastreabilidade SDD realista, sem criar Feature de produto.
- REQ-024: A documentacao permanente para gdevs deve refletir o comportamento
  final de PR/release antes de remover o plano histórico.
- REQ-025: A mudanca deve evitar alteracoes funcionais em frontend/backend que
  nao sejam necessarias para finalizar a infraestrutura SDD.

## Critérios de aceite

- Dado uma Issue SDD aberta e um PR de trabalho para `develop` com referencia
  explicita a ela, quando o PR for aberto, entao o Project mostra a Issue em
  `Review` e a Issue continua aberta.
- Dado um PR de trabalho para `develop` com `Refs #ID`, quando o trabalho tiver
  spec, entao o PR tambem contem `Spec: NNNNN` correspondente a mesma Issue.
- Dado um PR de trabalho para `develop` criado manualmente sem as referencias
  obrigatorias, quando a automacao avaliar o PR, entao ela nao identifica a Issue
  por titulo parecido, branch aproximada ou texto livre.
- Dado um PR de trabalho para `develop` em `Review`, quando o PR for fechado sem
  merge, entao a Issue relacionada volta para `In Progress`.
- Dado uma Issue em estado terminal, quando um PR de trabalho relacionado for
  fechado sem merge, entao a Issue nao e reaberta nem reclassificada.
- Dado um PR de trabalho para `develop` em `Review`, quando o PR for mergeado em
  `develop`, entao a Issue relacionada passa para `Ready for Release` e continua
  aberta.
- Dado um PR de trabalho mergeado em `develop`, quando a automacao final rodar,
  entao ela nao fecha a Issue e nao marca `Done` antes de um PR `develop` ->
  `main` efetivamente mergeado incluir essa entrega.
- Dado um PR `develop` -> `main` fechado sem merge, quando a automacao final
  rodar, entao ela nao altera Status de Issues, nao fecha Issues e nao produz
  `Done`.
- Dado um release `develop` -> `main` com multiplas Issues rastreadas, quando a
  entrega for efetivamente mergeada em `main`, entao todas e somente as Issues
  elegiveis do release ficam `Done` e fechadas como completed.
- Dado um PR `develop` -> `main` mergeado com sucesso, quando o workflow de deploy
  nao for acionado por nao haver alteracao em `frontend/**` nem
  `.github/workflows/deploy.yml`, entao as Issues elegiveis ainda podem chegar a
  `Done` conforme a regra desta fase.
- Dado uma falha de deploy posterior ao merge valido do PR `develop` -> `main`,
  quando a automacao de release ja tiver marcado Issues como `Done`, entao a
  falha operacional nao desfaz automaticamente `Done` nem reabre Issues.
- Dado um PR `develop` -> `main` sem listagem manual de todos os `Refs #ID`,
  quando a automacao determinar as Issues do release, entao ela usa um processo
  confiavel baseado nos PRs de trabalho rastreados ja integrados em `develop`.
- Dado uma Issue em `Rejected` ou `Canceled`, quando houver automacao de release,
  entao ela permanece encerrada como Not planned e nao e movida para `Done`.
- Dado o mesmo evento de PR/release processado mais de uma vez, quando a
  automacao rodar novamente, entao nao ha efeitos duplicados, corrupcao de Status
  nem fechamento incorreto.
- Dado a suite `node scripts/sdd/test.mjs`, quando executada, entao cobre os
  fluxos finais com GitHub simulado obrigatorio, sem rede e sem writes reais.
- Dado a validacao E2E final, quando executada, entao usa fixture tecnica
  controlada e demonstra o fluxo final sem depender de Feature de produto real.
- Dado a documentacao permanente atualizada, quando o plano histórico for removido,
  entao nao ha informacao operacional necessaria perdida para gdevs ou agentes.
- Dado o diff final da mudanca, quando revisado, entao frontend/backend nao tem
  alteracoes funcionais desnecessarias para esta infraestrutura.

## Dependências e questões abertas

Issue #16 consultada via `node scripts/sdd/issue.mjs 16` em 2026-10-01:
sem `blocked by` e sem Issues bloqueadas registradas.

Sem questoes abertas registradas nesta spec apos as decisoes humanas de
2026-10-01.

## Aprovação humana

Aprovada por `luvittor` em 2026-10-01, registrada no comentario da Issue #16:
https://github.com/gaydevs/gaydevs-platform/issues/16#issuecomment-5941368429
