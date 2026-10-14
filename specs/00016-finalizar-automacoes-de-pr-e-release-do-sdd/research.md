# Research

## Arquitetura de automacao assistida

Decision: nao automatizar integralmente movimentacoes do GitHub Project por
eventos de PR. Usar validacao automatica read-only para PRs e comandos
assistidos por agente/gdev para sincronizar Project.

Rationale: mover Project por evento exigiria infraestrutura e credenciais
adicionais, como GitHub App, credenciais privilegiadas, politicas especificas e
tratamento seguro de eventos. Esse custo e desproporcional ao beneficio de apenas
movimentar cards. O SDD ja assume que agente ou gdev consultam GitHub real via
`gh` e executam scripts versionados; essa automacao assistida reduz risco e
mantem o processo utilizavel sem IA.

Alternatives considered:

- Automacao integral por GitHub Actions: rejeitada pela decisao humana de
  simplificar e evitar credenciais privilegiadas em Actions para Project.
- GitHub App: rejeitado por adicionar instalacao, permissoes, rotacao/gestao de
  credenciais e superficie operacional desnecessarias nesta fase.
- Movimentacao manual de cards: rejeitada como fluxo esperado; continua possivel
  como excecao, mas o gdev deve poder pedir ao agente ou executar script.

## Evento do workflow de validacao

Decision: usar `pull_request` normal para check read-only em PRs cujo target e
`develop`.

Rationale: o workflow precisa apenas validar o contrato do PR e falhar/passsar um
status check. Ele nao move Project, nao fecha Issue e nao precisa de token
privilegiado. Portanto evento privilegiado de PR fica fora do caminho critico,
assim como GitHub App e politicas especiais relacionadas a esse evento. O check
e um guardrail automatico de consistencia; nao substitui review humano de outro
gdev em `develop` nem aprovacao/merge administrativo em `main`.

Alternatives considered:

- Evento privilegiado de PR: rejeitado porque seria necessario principalmente
  para escrever metadados com mais privilegio, o que deixou de ser objetivo.
- `push`: rejeitado porque nao bloqueia PR manual invalido antes do merge com a
  mesma clareza de um required status check de PR.
- Validacao somente pelo agente: rejeitada porque PR manual tambem precisa de uma
  barreira automatica configuravel em `develop`.

## Contrato `Refs`/`Spec`

Decision: implementar parser compartilhado e estrito para check e sync:
exatamente um `Refs #ID`; `Spec: NNNNN` exatamente uma vez quando o trabalho
exigir spec; `Spec` deve corresponder ao mesmo ID; closing keywords proibidas em
PR para `develop`.

Rationale: PRs manuais seguem suportados, mas precisam fornecer rastreabilidade
explicita. O parser comum evita divergencia entre o status check e os comandos
assistidos.

Alternatives considered:

- Inferir Issue pelo titulo, branch ou texto livre: rejeitado pela spec e por
  ambiguidade.
- Permitir varios `Refs` em PR de trabalho: rejeitado; release multiplo vem de
  varios PRs de trabalho integrados, nao de um PR de trabalho ambiguo.
- Usar closing keywords do GitHub: rejeitado porque PR para `develop` nao deve
  fechar Issue.

## Comandos assistidos

Decision: criar comandos semanticamente separados para sincronizar PR de trabalho
e finalizar release. Ambos relerem PR, Issue e Project antes de qualquer write.

Rationale: `status.mjs` deve continuar bloqueando transicoes finais arbitrarias.
Scripts dedicados podem validar contexto de PR/release e aplicar somente a matriz
permitida. Agentes e gdevs executam os mesmos comandos, preservando o fluxo sem
IA.

Alternatives considered:

- Adicionar flags secretas ao `status.mjs`: rejeitado porque confundiria operacao
  manual normal com transicoes derivadas de PR/release.
- Um unico comando generico para qualquer transicao: rejeitado por abrir margem a
  saltos indevidos e mensagens menos claras.

## Descoberta deterministica de release

Decision: exigir **Create a merge commit** para PRs de trabalho para `develop` e
descobrir o release selecionando PRs efetivamente mergeados com base `develop`
cujo `merge_commit_sha` persistido pelo GitHub pertence ao conjunto de commits
entregue pelo PR `develop -> main` e ausente de `main` antes do release.

Rationale: merge commits preservam um ponto identificavel para cada integracao em
`develop`. O comando de release pode comparar o intervalo entregue, consultar PRs
mergeados com base `develop`, filtrar pelo `merge_commit_sha`, ler `Refs`/`Spec`
dos proprios PRs e revalidar as Issues. Isso evita corpo manual no PR
`develop -> main` e evita heuristicas por titulo, branch, mensagem livre ou data.
O repositorio `gaydevs/gaydevs-platform` ja foi configurado em Settings > General
> Pull Requests com Allow merge commits habilitado, Allow squash merging
desabilitado e Allow rebase merging desabilitado; assim todos os PRs do
repositorio usam merge commit. Essa configuracao garante a premissa de
rastreabilidade do `release-sync`, enquanto a validacao de `merge_commit_sha`
continua como defesa adicional e nao como mecanismo principal para impedir
squash/rebase.
Nao usar `commits/{sha}/pulls` como mecanismo principal apos o commit chegar a
`main`, porque a API pode associar o commit ao PR que o introduziu na default
branch.

Alternatives considered:

- Corpo do PR de release listar todas as Issues: rejeitado pela decisao humana e
  pela spec.
- Data de merge desde a ultima release: rejeitada; data nao prova que o commit
  entrou no intervalo entregue.
- Titulo/branch/mensagem de commit: rejeitados como heuristicas.
- `commits/{sha}/pulls` como mecanismo principal: rejeitado porque pode apontar
  para o PR de release/default branch depois da promocao.
- Squash/rebase de PRs de trabalho: nao suportados neste fluxo porque eliminam a
  rastreabilidade escolhida de PR -> `merge_commit_sha` -> release -> Issue.

## Infraestrutura SDD reutilizavel

Decision: qualquer outro repositorio que adote esta infraestrutura SDD deve
reproduzir a configuracao de merge do repositorio, mantendo apenas merge commits
habilitados, salvo se a estrategia de rastreabilidade de releases for substituida
explicitamente por outra equivalente.

Rationale: a estrategia de release-sync depende de `merge_commit_sha` persistido
em PRs de trabalho. Repositorios que permitam squash ou rebase podem quebrar essa
rastreabilidade, a menos que adotem outra estrategia deterministica equivalente.

Alternatives considered:

- Permitir que cada repositorio escolha livremente squash/rebase/merge commit:
  rejeitado porque tornaria a descoberta de releases inconsistente.
- Tratar `merge_commit_sha` como unica barreira contra squash/rebase: rejeitado
  porque a configuracao do repositorio deve impedir esses metodos antes do merge;
  a validacao do script e defesa adicional.

## Estados e idempotencia

Decision: comandos usam matriz restrita e `write if needed`. Estados
incompativeis geram erro visivel; estados terminais `Rejected`, `Canceled` e
`Done` nao sao reabertos nem reclassificados.

Rationale: o GitHub e fonte da verdade. Reruns por gdev/agente devem ser seguros,
mas nao devem saltar etapas como `In Progress -> Ready for Release` sem passar
por contexto valido de PR.

Alternatives considered:

- Sempre forcar o destino calculado: rejeitado porque ocultaria inconsistencias.
- Guardar processamento em arquivo/artefato: rejeitado por criar estado paralelo.

## Fechamento Done

Decision: `Done` significa Project Status `Done` e Issue `closed` com
`state_reason: completed`.

Rationale: `not_planned` fica reservado a `Rejected` e `Canceled`, conforme a
constitution e os scripts atuais. Deploy continua preocupacao operacional
separada nesta fase.

## Sandbox e E2E

Decision: preservar a sandbox/fake GitHub e estende-la para PRs, validacao de
contrato, merge commits, release manual vazio, deduplicacao e PATCH completed.
O E2E real final usa fixture tecnica SDD, nao Feature de produto.

Rationale: `node scripts/sdd/test.mjs` e o comando oficial e ja bloqueia rede e
writes reais. A nova cobertura deve seguir o mesmo desenho e provar o fluxo
simplificado.

Alternatives considered:

- Testar rotina contra GitHub real: rejeitado; somente o E2E controlado final
  deve tocar recursos reais, com gates humanos.
- Relaxar guards do sandbox: rejeitado porque os guards sao parte do requisito.
