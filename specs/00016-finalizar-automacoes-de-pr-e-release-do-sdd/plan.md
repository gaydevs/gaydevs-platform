# Plano tecnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/16 · Spec: [spec.md](spec.md)
Aprovacao da spec: gdev `luvittor`, 2026-10-01, comentario
https://github.com/gaydevs/gaydevs-platform/issues/16#issuecomment-5941368429

## Contexto tecnico

Tipo de demanda: Tech Debt SDD, sem mudanca funcional em frontend/backend.
Area afetada: scripts SDD (`scripts/sdd`), sandbox SDD, documentacao permanente
e um workflow simples de validacao de PR.

Base atual observada:

- Branch local: `techdebt/00016-finalizar-automacoes-de-pr-e-release-do-sdd`.
- Diretorio da feature: `specs/00016-finalizar-automacoes-de-pr-e-release-do-sdd/`.
- Issue #16 relida via `node scripts/sdd/issue.mjs 16` em 2026-10-02: aberta,
  tipo `Tech Debt`, sem `blocked by` e sem `blocking`.
- Aprovacao humana da spec registrada por `luvittor` em 2026-10-01.
- Status existentes no Project: `Backlog`, `Specifying`, `Ready`, `In Progress`,
  `Review`, `Ready for Release`, `Done`, `Rejected`, `Canceled`.
- `status.mjs` normal aceita apenas `Backlog`, `Specifying`, `Ready`,
  `In Progress`, `Rejected` e `Canceled`; `Review`, `Ready for Release` e `Done`
  continuam reservados para comandos especificos de PR/release.
- Workflow existente: apenas deploy, com `contents: read` e gatilho em push para
  `main`/`master` restrito a `frontend/**` e `.github/workflows/deploy.yml`.

## Decisao arquitetural

Nao implementar automacao integral das movimentacoes do GitHub Project por eventos
de PR. O modelo aprovado e de automacao assistida por agente, com suporte manual
equivalente.

A razao e intencional e deve ficar permanente na documentacao: automatizar 100%
as transicoes do Project por eventos exigiria infraestrutura e credenciais
adicionais, como GitHub App, credenciais privilegiadas, politicas especificas e
tratamento seguro de eventos. Esse custo e desproporcional ao beneficio de apenas
movimentar cards.

Divisao aprovada:

- GitHub Actions: valida somente o contrato de PR para `develop`, sem mover cards
  e sem credenciais privilegiadas do Project.
- Agente de IA: parte prevista da automacao operacional SDD; consulta GitHub real
  via `gh`, executa scripts versionados, sincroniza Project, prepara PRs quando
  solicitado, identifica estado atual antes de agir e para nos gates humanos.
- Sem IA: o processo continua utilizavel por gdevs executando os mesmos scripts.
- Humanos: continuam responsaveis por aprovacao da spec, aprovacao do plan,
  review do PR para `develop`, merge em `develop`, aprovacao administrativa e
  merge em `main`.

GitHub continua sendo a fonte da verdade. O agente nao e fonte da verdade.

## Abordagem

Implementar tres superficies simples e separadas:

1. `scripts/sdd/pr-check.mjs`: validacao read-only do contrato de PR. Usado por
   GitHub Actions em `pull_request` e tambem executavel manualmente.
2. `scripts/sdd/pr-sync.mjs`: sincronizacao assistida de PR de trabalho para
   `develop`. Consulta o PR real e a Issue real antes de mover `In Progress` /
   `Review` / `Ready for Release`.
3. `scripts/sdd/release-sync.mjs`: finalizacao assistida de PR `develop -> main`.
   Consulta o PR real, descobre Issues do release por Git/GitHub, move
   `Ready for Release -> Done` e fecha Issues como `completed`.

Nomes finais podem mudar na implementacao, mas o plan fixa a separacao:
validacao automatica read-only em Actions; sincronizacao de Project por comando
explicito executado por agente ou gdev.

## Validacao automatica de PR para develop

Criar futuramente um workflow simples com evento normal `pull_request`, filtrado
para target `develop`. Ele nao usa evento privilegiado de PR, nao usa GitHub App,
nao usa token privilegiado para Project e nao movimenta cards.

Responsabilidade do check:

- Existe exatamente um `Refs #ID`.
- A Issue existe.
- O numero referencia uma Issue, nao um Pull Request.
- A Issue e SDD elegivel: tipo nativo conhecido e marcador
  `<!-- gaydevs-sdd:TIPO -->` coerente.
- Se o trabalho exige spec, existe exatamente um `Spec: NNNNN`.
- `Spec:` corresponde ao mesmo ID de `Refs`.
- PR para `develop` nao usa `Closes`, `Fixes`, `Resolves` ou variantes para a
  Issue.
- Referencias ambiguas ou invalidas falham.

Esse check deve poder ser configurado como required status check de `develop`.
Ele e um guardrail automatico de consistencia do contrato SDD: bloqueia PRs com
rastreabilidade invalida, mas nao substitui gates humanos. O review obrigatorio
de outro gdev antes do merge em `develop` continua sendo o gate humano de revisao.
A aprovacao administrativa e o merge em `main` continuam sendo o gate humano de
release. PRs manuais continuam totalmente suportados.

PR manual deve informar:

```text
Refs #ID
```

E, quando houver spec:

```text
Spec: NNNNN
Refs #ID
```

Quando agente/script criar o PR, deve preencher essas referencias automaticamente.

## Sincronizacao assistida de PR de trabalho

O gdev nao deve precisar arrastar cards manualmente. Com agente, o gdev pede para
continuar; o agente consulta GitHub, executa o script apropriado e sincroniza o
Project. Sem agente, o gdev executa o mesmo comando.

Fluxo proposto para `pr-sync`:

```sh
node scripts/sdd/pr-sync.mjs PR_NUMERO
```

O comando consulta o PR real, valida o contrato do PR, rele a Issue e o Status
do Project, e entao aplica somente as transicoes permitidas:

- PR de trabalho aberto/reaberto para `develop`: se Issue estiver em
  `In Progress`, mover para `Review`; se ja estiver em `Review`, no-op
  idempotente; outros estados nao terminais incompativeis geram erro visivel.
- PR fechado sem merge: se Issue estiver em `Review`, mover para `In Progress`;
  se `Rejected`, `Canceled` ou `Done`, no-op; outros estados incompativeis geram
  erro visivel.
- PR mergeado em `develop`: se Issue estiver em `Review`, mover para
  `Ready for Release`; se ja estiver em `Ready for Release`, no-op; Issue
  permanece aberta.

`pr-sync` nao aprova review, nao mergeia PR, nao fecha Issue e nao registra
aprovacao humana.

## Sincronizacao assistida de release

Fluxo proposto para `release-sync`:

```sh
node scripts/sdd/release-sync.mjs PR_NUMERO
```

O comando consulta o PR real. Se for PR `develop -> main` fechado sem merge, nao
faz nenhuma alteracao. Se for PR `develop -> main` mergeado, descobre as Issues
do release e finaliza somente Issues elegiveis:

- Status atual precisa ser `Ready for Release`.
- Transicao: `Ready for Release -> Done`.
- Fechamento: Issue `closed` com `state_reason: completed`.

Estados `Rejected`, `Canceled` e `Done` continuam terminais. Estados
incompativeis nao saltam etapas; geram erro/inconsistencia visivel.

`status.mjs` normal deve continuar sem liberar `Review`, `Ready for Release` e
`Done` como transicoes manuais arbitrarias.

## Descoberta de Issues do release

O PR `develop -> main` pode ser aberto manualmente e nao precisa conter lista de
Issues no body. A descoberta deve usar Git/GitHub, nao texto preparado no PR de
release.

Estrategia escolhida:

1. Exigir que PRs de trabalho para `develop` usem **Create a merge commit**. Esse
   e o metodo suportado pelo SDD; squash e rebase nao sao suportados nesse fluxo,
   porque eliminam a rastreabilidade escolhida para release. Essa regra deve
   entrar no onboarding, validacoes e documentacao permanente.
   O repositorio `gaydevs/gaydevs-platform` ja foi configurado em Settings >
   General > Pull Requests com Allow merge commits habilitado, Allow squash
   merging desabilitado e Allow rebase merging desabilitado. Consequentemente,
   todos os PRs do repositorio usam merge commit. Isso garante a premissa de
   rastreabilidade usada pelo `release-sync`; a validacao de `merge_commit_sha`
   no `release-sync` continua como defesa adicional, nao como mecanismo principal
   para impedir squash/rebase.
2. Para um PR `develop -> main` mergeado, comparar o range que entrou em `main`:
   commits contidos no `develop` entregue pelo PR de release e que ainda nao
   estavam em `main` antes daquele release.
3. Consultar, por REST ou GraphQL conforme ficar mais simples e paginavel, os PRs
   efetivamente mergeados com base `develop`.
4. Para cada PR de trabalho, usar o `merge_commit_sha` persistido pelo GitHub.
5. Selecionar somente os PRs cujo `merge_commit_sha` pertence ao conjunto de
   commits do intervalo do release.
6. Ler `Refs #ID` e `Spec: NNNNN` dos proprios PRs de trabalho.
7. Revalidar cada Issue pelo GitHub atual.
8. Deduplicar por Issue number.
9. Finalizar apenas Issues SDD elegiveis que estejam em `Ready for Release`.

Essa solucao evita depender de:

- corpo do PR `develop -> main`;
- titulo;
- branch aproximada;
- mensagem livre de commit;
- data de merge como heuristica.

Se a implementacao constatar que um PR de trabalho entrou em `develop` sem merge
commit rastreavel, `release-sync` deve falhar com erro explicito para revisao
humana, em vez de inferir por heuristica.

## Idempotencia

Todos os comandos devem operar como `read -> validate -> decide -> write if
needed`:

- Reexecutar `pr-sync` em PR ja sincronizado deve ser no-op.
- Reexecutar `release-sync` deve pular Issues ja `Done`/completed e concluir
  apenas pendencias elegiveis.
- Duplicatas no release sao deduplicadas por Issue number.
- Falhas parciais precisam deixar o estado visivel e permitir rerun seguro.

## Seguranca

O workflow de PR deve ser read-only para o Project:

- Usar evento normal `pull_request`.
- Usar apenas permissoes minimas necessarias para ler PR/Issue; se possivel,
  `contents: read` e `pull-requests: read`.
- Nao usar evento privilegiado de PR.
- Nao usar GitHub App.
- Nao usar credencial privilegiada para Project em Actions.
- Nao usar politica especial relacionada a evento privilegiado de PR.
- Nao executar comandos vindos de body/comentarios/titulo/branch do PR.
- Nao executar codigo nao confiavel com credenciais privilegiadas.
- Nao disponibilizar secrets de deploy nesse workflow.

A sincronizacao do Project ocorre por `gh` no contexto do gdev/agente que ja tem
permissao para a rotina SDD. Falhas de permissao devem ser informadas, nunca
ocultadas.

## Impactos e dependencias

Sem banco, migrations, API de produto, frontend ou backend.

Dependencias tecnicas:

- GitHub Actions `pull_request` para validacao read-only.
- GitHub REST/GraphQL via `gh` para ler PRs, Issues, commits, Project e escrever
  Status/fechamento quando o gdev/agente executar os scripts.
- Git local/GitHub API para formar o conjunto de commits do intervalo de release
  e selecionar PRs de trabalho por `merge_commit_sha`.
- Sandbox SDD atual estendida com fixtures de PR, merge commits, releases e
  validacao read-only.

Documentacao permanente a atualizar na implementacao:

- `CONTRIBUTING.md` com PR manual, `Refs`, `Spec`, uso recomendado/opcional de
  agente e comandos de sincronizacao.
- `docs/development-workflow.md` com automacao assistida, merge commit obrigatorio
  em PRs de trabalho, ausencia de lista manual no PR de release e gates humanos.
- `docs/sdd-implementation.md` com estado auditado da 2C, validacoes, limites e
  justificativa da simplificacao.
- `docs/sdd-sandbox.md` se novos cenarios/guards forem acrescentados.
- `AGENTS.md` com comandos oficiais novos e responsabilidades do agente.
- Documentacao/onboarding curta: SDD funciona com ou sem IA; agente e recomendado
  para reduzir trabalho operacional; qualquer agente pode ser usado se ler as
  instrucoes do repo e seguir scripts/contratos; interacao tipica: "Leia a Issue
  #27 e comece."; GitHub e fonte da verdade; gates humanos continuam humanos; sem
  agente, os mesmos comandos podem ser executados manualmente.
- Documentacao da infraestrutura SDD reutilizavel: qualquer outro repositorio que
  adote esta infraestrutura SDD deve reproduzir a configuracao de merge do
  repositorio, mantendo apenas merge commits habilitados, salvo se a estrategia
  de rastreabilidade de releases for substituida explicitamente por outra
  equivalente.
- O plano histórico deve ser auditado apenas no fim da implementacao validada; migrar
  conteudo permanente necessario e remover o arquivo somente depois.

## Artefatos de design

- [research.md](research.md): decisoes tecnicas e alternativas descartadas.
- [data-model.md](data-model.md): entidades, validacoes e transicoes.
- [contracts/sdd-pr-contract-and-sync.md](contracts/sdd-pr-contract-and-sync.md):
  contrato do check de PR e dos comandos assistidos.
- [quickstart.md](quickstart.md): roteiro de validacao futura, usando
  `node scripts/sdd/test.mjs` como comando oficial.

## Validacao

Validacao futura oficial:

```sh
node scripts/sdd/test.mjs
```

Cenarios obrigatorios na sandbox:

- Parser `Refs`/`Spec`.
- PR manual valido.
- PR sem Issue bloqueado pela validacao.
- Issue inexistente.
- Issue fora do SDD.
- Spec divergente.
- Closing keyword proibida.
- `In Progress -> Review`.
- `Review -> In Progress` em close sem merge.
- `Review -> Ready for Release` em merge develop.
- `Ready for Release -> Done` + `completed` em release.
- Multiplas Issues.
- Deduplicacao.
- Estados terminais.
- Idempotencia.
- Release PR manual com corpo vazio.
- Descoberta correta pelas integracoes anteriores em develop, selecionando PRs
  mergeados em `develop` cujo `merge_commit_sha` pertence ao intervalo que ainda
  nao estava em `main`.

Tudo sem rede e sem writes reais.

E2E tecnico real ao final da implementacao: usar fixture tecnica SDD, sem Feature
de produto, com PR de trabalho que pode simular abertura manual; check automatico
valida o contrato; agente/script sincroniza Project; review/merge continuam
humanos; PR `develop -> main` pode ser manual; agente/script descobre Issues sem
body de release e finaliza `Done` + `completed`.

## Constitution check

Pre-design:

- Issue #16 existe antes da branch/spec, e o ID `00016` vem da Issue.
- Uma unica spec cobre a Tech Debt; nao ha spec por camada.
- Requisitos e criterios de aceite estao em `spec.md`; este plan registra o
  como tecnico.
- Issue #16 foi relida via GitHub atual em 2026-10-02 e nao possui blockers.
- Aprovacao humana da spec foi identificada em comentario do gdev `luvittor`
  em 2026-10-01.
- A decisao humana de simplificar a arquitetura foi incorporada sem reabrir as
  decisoes funcionais da spec.

Post-design:

- O design preserva gates humanos: spec, plan, review para `develop`, merge em
  `develop` e aprovacao/merge administrativo para `main` nao sao automatizados.
- O design nao executa codigo nao confiavel de PR com credenciais privilegiadas.
- `status.mjs` normal permanece sem transicoes finais arbitrarias.
- GitHub e fonte da verdade; agente e operador assistido, nao autoridade.
- SDD permanece utilizavel sem IA pelos mesmos scripts.
- `Done` ocorre somente por release `develop -> main` mergeado, com fechamento
  `completed`; `Rejected` e `Canceled` permanecem Not planned.
- Frontend/backend permanecem fora do escopo funcional.

Resultado: sem violacoes constitucionais conhecidas.

## Aprovacao humana

Pendente. Parar neste gate para aprovacao humana do plan antes de criar
`tasks.md` ou implementar codigo.
