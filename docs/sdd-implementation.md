# Implantação SDD — Rodadas 2A, 2B e 2C

Estado da Rodada 2B: proteções clássicas complementadas em 2026-09-30 e governança
administrativa transferida para `gdevs-admins` em 2026-10-01;
integração do checkpoint e ativação de CODEOWNERS em main pendentes dos gates
humanos descritos ao final. O registro da Rodada 2A abaixo é histórico.

Auditoria ao vivo: 2026-09-30, via gh 2.101.0 e interface do GitHub.
Registro administrativo: [Issue #8](https://github.com/gaydevs/gaydevs-platform/issues/8).
O plano histórico inicial foi auditado, migrado para a documentação permanente
e removido na Rodada 2C. A Rodada 2A foi autorizada pelo gdev naquela sessão;
isso não constitui aprovação de spec, plan, PR ou release de produto.

## Estado confirmado

- Repo canônico: `gaydevs/gaydevs-platform`, ID `1388307090`. O remoto antigo
  `gaydevs-frontend` redireciona para ele; o default do gh neste checkout é o canônico.
- Conta `luvittor`: admin do repo e owner da organização. Escopos `project` e
  `admin:org` obtidos e confirmados; nenhum token foi gravado no repo.
- PR [#9](https://github.com/gaydevs/gaydevs-platform/pull/9) mergeado em develop.
  Branch `techdebt/00008-sdd-foundation` sincronizada com develop no commit
  `772ae49`, preservando os commits anteriores. O checkpoint SDD ainda não está
  integrado em develop; main ainda contém apenas o form Team Access.
- Issue #8 permanece aberta como Task administrativa de bootstrap, fora do
  auto-add por tipo. Nenhuma Feature real, spec de produto ou branch nova foi criada.

## Organização e Project

[**gaydevs project — #1**](https://github.com/orgs/gaydevs/projects/1), privado,
pertence à organização `gaydevs` e está vinculado ao repo. A organização não tinha
Projects na consulta anterior à criação. View `SDD` em formato board.

Acesso persistido e relido na interface:

- membros da organização: **Read** como base role deste Project;
- `gdevs-team`: **Write**, configurado via gh;
- owners/admins da organização: **Admin** por herança nativa; owner atual: `luvittor`.

A API pública consultada não expõe base role nem a lista completa de permissões
no objeto ProjectV2. A verificação desses papéis usa a página Manage access;
privacidade, equipe vinculada e `viewerCanUpdate` também foram relidos via gh.
Não houve teste autenticado com uma segunda conta de membro comum.

Tipos nativos habilitados: Feature, Bug, **Refactor** e **Tech Debt**. Os dois
últimos foram criados nesta rodada. Task existente foi preservado; Team Access
continua usando o form original sem tipo, preservado byte a byte.

Priority é o **Issue Field da organização** `47412460`, visível aos membros,
com **High → Medium → Low**. Os IDs dessas opções foram preservados. Urgent foi
removido somente após listar todos os repos/Issues e reler seus valores: não
havia uso dessa opção. O Project expõe o mesmo campo (`isIssueField: true`),
sem criar uma prioridade independente.

Status, na ordem configurada:

`Backlog → Specifying → Ready → In Progress → Review → Ready for Release → Done → Rejected → Canceled`

Número, IDs do Project, Status/opções, Priority/opções, tipos, equipe e workflows
estão em [`.github/sdd.json`](../.github/sdd.json). São um registro auditado;
configuração local não substitui releitura do GitHub. Os scripts continuam
resolvendo o Project/Status pelo número e nomes no estado remoto.

## Auto-add e fallback

Workflow nativo **Auto-add to project** habilitado para `gaydevs-platform`:

```text
is:issue type:Feature,Bug,Refactor,"Tech Debt"
```

Filtro salvo e relido na interface; habilitação relida via gh. A inclusão foi
observada nos quatro tipos usando fixtures técnicas. Task e sem tipo ficaram
fora após atualizações e nova leitura; Team Access atual é sem tipo. `is:issue`
exclui PRs. Outros tipos não pertencem à lista positiva.

Somente dois workflows estão ativos:

- Auto-add to project: filtro acima;
- Item added to project: define **Backlog**.

Foram desativados os defaults Auto-add sub-issues, Auto-close issue, Item closed,
Pull request linked to issue e Pull request merged, para não introduzir entradas
fora do filtro ou antecipar automações finais de PR/release.

A inclusão é assíncrona: a fixture Feature demorou além da primeira janela de
verificação, mas apareceu na releitura. Para uma Issue nova elegível, se o card
não aparecer ou o workflow estiver indisponível, o fallback explícito é:

```sh
node scripts/sdd/status.mjs NUMERO Backlog
```

Consultar primeiro o card para não resetar um trabalho em andamento. O script
exige tipo nativo e marcador correspondente do form, e reutiliza o mesmo item
quando ele já existe. O filtro nativo seleciona por tipo; não autentica a origem
do form nem exige o marcador. Auto-add também não remove cards já adicionados
quando o tipo muda. Esses casos precisam de revisão explícita. A regra atual
cobre somente este repo; futuros repos exigem configurar e validar sua entrada.

## Validação ao vivo e local

Fixtures [#10](https://github.com/gaydevs/gaydevs-platform/issues/10) e
[#11](https://github.com/gaydevs/gaydevs-platform/issues/11) usadas exclusivamente
para QA da configuração, restauradas a Tech Debt, encerradas e com cards Done
arquivados ao final. Não são demandas de produto.

- Auto-add dos quatro tipos; exclusão de Task e sem tipo; Team Access #7 fora
  do board e recusado pelo script; nenhuma Issue de produto criada.
- Item contém o node ID da própria Issue; adição repetida não duplicou o card.
- High, Low e Medium escritos por `priority.mjs` e relidos na Issue e no card.
- Status escritos e relidos via gh; Backlog/Specifying também exercitados pelo
  CLI `status.mjs`. Done validado após encerrar a fixture.
- `dependency.mjs` adicionou #10 blocked by #11; leitura confirmou também
  #11 blocking #10. Ready e In Progress foram recusados com blocker aberto.
  Relação removida pelo script e ausência relida nos dois sentidos.
- `node scripts/sdd/test.mjs`: 12 testes passaram.
- Configurações remotas relidas após alterações; JSON e diff local conferidos.

`status.mjs` preserva o limite desta implantação: Backlog, Specifying, Ready,
In Progress, Rejected e Canceled. Rejected e Canceled encerram a Issue como
Not planned. Review, Ready for Release e Done são manipuláveis pela API gh, mas
seguem fora do CLI até as transições finais. Os exercícios de QA não representam
aprovação humana nem implantação das transições finais.
A configuração de permissões permite o uso por gdevs com Write e token `project`;
o teste real de escrita foi feito com a conta admin disponível.

## Rodada 2B — integração e proteções

Escopo autorizado por `luvittor` em 2026-09-30 nesta sessão: complementar as
proteções existentes, publicar/integrar o checkpoint por PR, validar a entrada
SDD a partir de develop e preparar a promoção administrativa. Essa autorização
não equivale a review de outro gdev, aprovação de PR ou autorização para ignorar
os gates humanos. A Issue #8 permanece aberta como registro administrativo;
seu texto original descreve a fase 1.

Auditoria de entrada via gh: checkout limpo e publicado em `8a1927f`, quatro
commits à frente de develop e nenhum atrás. `develop` em `198b176`, `main` em
`da1f4f0`, default main, nenhum PR aberto e PR #9 já mergeado. Os 55 arquivos
do checkpoint SDD ainda não estavam em develop. Nenhuma Feature foi criada.

Foram complementadas as duas proteções clássicas existentes, preservando os
IDs `BPR_kwDOUr_iks4E_l-4` (develop) e `BPR_kwDOUr_iks4E_hxw` (main). As alterações
foram relidas pela API após cada gravação. Não foram criadas rulesets sobrepostas.

| Controle | develop | main |
| --- | --- | --- |
| PR e aprovação obrigatória | 1 de outro gdev com Write | 1 e code owner habilitado; ativação depende de CODEOWNERS na base |
| Invalidar aprovação quando o diff mudar | Sim | Sim |
| Conversas resolvidas | Obrigatório | Obrigatório |
| Aplicar também aos admins | Sim | Sim |
| Bypass explícito de PR | Nenhum | Nenhum |
| Atualização/merge | Gdevs com permissão, cumprindo o PR | Team `gdevs-admins`; admins mantêm acesso nativo, cumprindo o PR |
| Descartar reviews | Permissão padrão do GitHub | Team `gdevs-admins` |
| Force push / exclusão | Bloqueados | Bloqueados |
| Histórico linear obrigatório | Não | Não |
| Checks obrigatórios | Nenhum | Nenhum |

PR e review obrigatórios restringem push direto também para admins. O GitHub
impede autoaprovação nativamente. Não foi exigido o deploy como check de PR:
ele executa depois do push e somente para os caminhos já configurados.
O merge commit continua permitido para preservar o histórico.

### Aprovação administrativa e limites

`.github/CODEOWNERS` usa `* @gaydevs/gdevs-admins`. O team Visible tem acesso
Admin explícito ao repo. A exigência de code owner está ligada somente em
main; develop continua permitindo review de outro gdev com Write.
O GitHub usa o CODEOWNERS da **branch base**, portanto a aprovação administrativa
não está tecnicamente garantida até esse arquivo chegar a main. O primeiro PR
que o instala exige conferência humana da aprovação administrativa. A restrição
de merge em main já está ativa. Reviews de outros gdevs continuam permitidos;
após o bootstrap não substituem o code owner obrigatório.

Enquanto houver apenas um membro em `gdevs-admins`, outro gdev precisa abrir o
PR `develop → main` para que esse membro possa aprová-lo. Não criar a promoção
pela conta do único code owner e depois dispensar seu review.
A branch de origem normalmente deve ser develop, mas não existe filtro de head
branch nessa proteção clássica: essa conferência fica com o admin. A composição
administrativa passa a ser gerenciada no team, sem editar CODEOWNERS ou as listas
por mudança de membro. O team deve permanecer Visible e com Admin no repo.
Admins externos ao team mantêm acesso nativo de atualização, mas não substituem
a aprovação de um membro do team quando CODEOWNERS estiver na base. Administradores ainda
podem editar as próprias configurações; não existe garantia contra essa ação.

O repo é público e a organização usa Free: proteções clássicas estão disponíveis.
A API de rulesets do repo retornou lista vazia, inclusive com herança; a API de
rulesets da organização retornou 403 exigindo GitHub Team. Nenhum upgrade foi
feito. A primeira falha de gh nesta sessão foi de rede do sandbox; a consulta
com acesso de rede confirmou autenticação válida e os escopos necessários.

### Integração e verificações pendentes de review humano

Validação local da Rodada 2B: os 12 testes de `node scripts/sdd/test.mjs`
passaram, e `git diff --check` não encontrou erros. O diff de frontend/backend
e do workflow de deploy contra origin/main permaneceu vazio. A releitura GraphQL
confirmou os mesmos dois IDs de proteção e zero permissões de bypass de PR.

O [PR #12](https://github.com/gaydevs/gaydevs-platform/pull/12) foi publicado de
`techdebt/00008-sdd-foundation` para develop, incluindo o commit `ad1f81f` da 2B.
A releitura ao vivo confirmou `MERGEABLE`, `BLOCKED`, `REVIEW_REQUIRED` e nenhuma
review: não há conflito de merge, mas o gate de aprovação está bloqueando o PR
mesmo para a conta admin/autora. A API de erros de CODEOWNERS na branch do PR
retornou `errors: []`. Isso valida o arquivo publicado, não sua ativação em main.

O workflow de deploy em main e na branch do PR tem o mesmo blob
`610f6678f38197b440e4e6875052710695864480`. Os workflows finais de Project seguem
desativados; apenas Auto-add e Item added estão ativos. A comparação ao vivo de
develop com main retornou zero arquivos diferentes antes da integração do #12;
não foi criado um PR vazio de promoção para simular uma validação de release.
As proteções de main foram relidas, mas o comportamento de uma promoção real e
o início SDD em origin/develop continuam pendentes. A Rodada 2B não está concluída.

O checkpoint deve entrar por esse PR, com
`Refs #8`, review de outro gdev e **Create a merge commit**. Não recriar o PR #9,
não fazer squash/rebase do checkpoint e não fechar a Issue #8 nessa integração.

Enquanto esse PR não for integrado, origin/develop não contém os scripts nem os
templates SDD. Não declarar `from-issue --start` validado nessa base. Após o merge,
executar em checkout isolado de origin/develop com uma fixture técnica Tech Debt,
consultando primeiro Issue/dependências e respeitando o número atribuído pelo
GitHub; verificar branch derivada de develop, rascunho único, contexto remoto
relido e Status. Não esperar ponteiro ou snapshot local de contexto.
Não implementar uma Feature nem aprovar spec/plan durante essa verificação.

Depois, outro gdev abre a promoção `develop → main`, com `Refs #8`; um membro
de `gdevs-admins` aprova e o merge é realizado por admin. Os forms só aparecem na
interface de New Issue depois de chegarem à default main. Reler CODEOWNERS,
proteções e estado do PR antes de
considerar esse gate validado. Nenhuma aprovação/merge foi automatizada.

### Governança administrativa — 2026-10-01

Correção autorizada por `luvittor` nesta sessão, sem merge do PR #12. A auditoria
encontrou somente `gdevs-team` (Write); não existia team administrativo equivalente.
Foi criado [gdevs-admins](https://github.com/orgs/gaydevs/teams/gdevs-admins), ID
`19830724`, node ID `T_kwDOE-iGEc4BLpfE`, Visible (`privacy: closed` na API).
`luvittor` é o membro inicial ativo, com papel maintainer atribuído na criação.
O team recebeu Admin explícito no repo; `gdevs-team` manteve Write.

As listas de atualização e descarte de reviews de main passaram de `luvittor`
para `gdevs-admins`, com listas de usuários vazias. Os demais gates foram
preservados. A referência pessoal anterior em CODEOWNERS foi substituída pelo
team no mesmo PR #12. Os registros de auditoria da conta acima são históricos.
Esta mudança concede Admin no repositório, não o papel de owner da organização.

Validação ao vivo via REST/GraphQL: team Visible, membership ativa, Admin no repo
e Write de `gdevs-team` confirmados. Comparação dos snapshots antes/depois mostrou
develop idêntica e main alterada somente nas listas de usuários/teams de atualização
e descarte de reviews; todos os outros gates e zero bypass foram preservados.
Os 12 testes SDD passaram e `git diff --check` passou. Frontend, backend, deploy,
`.specify/feature.json` e `.specify/context` não foram alterados naquela correção
de governança; a dependência desses mecanismos foi removida na correção abaixo.

### Contexto local pela branch — 2026-10-01

Correção arquitetural autorizada nesta sessão, no mesmo PR #12 e sem merge.
O resolver compartilhado do Spec Kit passou a usar a branch Git deste worktree,
extrair o ID SDD e exigir exatamente uma pasta `specs/NNNNN-*`. Branch inválida,
spec ausente e ambiguidade falham claramente. `SPECIFY_FEATURE_DIRECTORY` pode
selecionar uma pasta existente somente no ambiente da execução; não é gravado
em arquivo, cache, configuração Git ou ambiente persistente. `SPECIFY_FEATURE`
é recusado explicitamente, orientando usar a branch SDD ou o override de diretório.

`from-issue` deixou de gravar `.specify/feature.json` e `.specify/context/NNNNN.json`.
Resíduos antigos permanecem ignorados e nunca participam da resolução, mesmo
com JSON inválido ou dados obsoletos. Não foi criado um substituto global. Issue,
comentários, Priority e dependências devem ser relidos por `issue.mjs` via gh.
A auditoria não encontrou outro ponteiro de feature no fluxo instalado; os
manifests/registries são configurações de instalação/projeto. As extensões
opcionais git/agent-context não estão instaladas. Origem upstream, adaptações e
limites estão documentados em [UPSTREAM.md](../.specify/UPSTREAM.md).

Validação daquele checkpoint: **22 testes passaram** em `node scripts/sdd/test.mjs`, incluindo:

- Os quatro prefixos de branch, troca entre duas features e worktrees independentes.
- Erros de branch inválida, detached HEAD sem override, spec ausente e ambiguidade.
- Override relativo/absoluto efêmero, execução sem Git com override e rejeição de
  SPECIFY_FEATURE mesmo combinado com override válido.
- Resíduos legados inalterados, ausência de cache substituto e infraestrutura
  compartilhada sem alterações durante a resolução.
- `from-issue` com Git real e remoto bare local, `setup-plan`, `setup-tasks` e
  contratos de `check-prerequisites` usados por implement/analyze/clarify/checklist/converge.
- Todos os testes SDD anteriores, com a expectativa do ponteiro removida.

Os testes usam repositórios/worktrees temporários, Git e PowerShell 7 reais e API
GitHub simulada para a fixture de from-issue. Nenhuma Feature real foi criada.
Frontend, backend e deploy permanecem intactos. Isso não substitui a validação
ao vivo após integrar o PR #12 em origin/develop; essa integração segue pendente
de review humano. Trabalhos simultâneos em branches diferentes exigem worktrees
separados, porque processos no mesmo checkout continuam compartilhando o HEAD Git.

### Suíte sandbox reproduzível — 2026-10-01

O primeiro checkpoint de `node scripts/sdd/test.mjs` executou **55 testes:
55 passaram, 0 falharam, 0 ignorados**, em aproximadamente 108 segundos no
Windows com Node 24.15.0 e PowerShell 7.6.6. `git diff --check` passou.
Cobertura e limites estão em [sdd-sandbox.md](sdd-sandbox.md).

A execução posterior pelo gdev revelou uma dependência da página de código do
terminal: o template de constitution gerava JSON inválido em OEM 437/850.
O erro foi reproduzido na mesma posição 644: a seta era convertida em SUB (0x1A).
`common.ps1` e o launcher da sandbox agora explicitam UTF-8 sem BOM.
A regressão falhou antes da correção e passou depois, verificando conteúdo
Unicode integral sob 437, 850, 1252 e 65001. Não há sanitização do JSON.
Após a correção, a suíte completa passou: **56 testes, 56 pass, 0 fail,
0 skipped**, em aproximadamente 113 segundos. `git diff --check` passou.

Os seis scripts SDD e os seis helpers PowerShell foram exercitados com Git real,
remotos bare/worktrees temporários e gh fake obrigatório. As chamadas ao fake
verificam método, endpoint e body. A suíte bloqueia gh real e rede, verifica
resíduos legados/override efêmero e comprova a limpeza após falha intencional.
Nenhuma fixture deixa branch, repo ou worktree no checkout de trabalho.

O cenário integrado usa decisões externas fictícias explicitamente identificadas
como entradas de teste. Não autentica nem concede aprovação humana. Nenhuma
Feature/Issue/card real foi criada e houve **zero writes reais no GitHub pela
suíte**. Commit/push e atualização deste PR são publicação separada do checkpoint.
Frontend, backend, helpers de produção e deploy não foram alterados nesta etapa.

Releitura via gh confirmou PR #12 aberto para develop, REVIEW_REQUIRED/BLOCKED;
develop mantém uma aprovação atualizada e conversas resolvidas, inclusive para
admins; main mantém uma aprovação, code owner e restrição ao team gdevs-admins.
A suíte não comprova o efeito remoto dessas regras nem substitui o teste após
integração em origin/develop. Review/merge humano, promoção e bootstrap de
CODEOWNERS em main continuam pendentes. Não houve merge ou automação da 2C.

### Estados Not planned — 2026-10-01

Atualização autorizada por `luvittor` nesta sessão, no mesmo PR #12 e sem merge.
O campo Status do Project recebeu as opções **Rejected** (`25316d13`) e
**Canceled** (`01b977e1`), preservando as sete opções anteriores e sua ordem.
O registro auditado em `.github/sdd.json` foi atualizado após releitura do
Project real.

`status.mjs` agora aceita Backlog, Specifying, Ready, In Progress, Rejected e
Canceled. Rejected representa demanda analisada e decidida como não sendo feita.
Canceled representa demanda anteriormente aceita/iniciada e depois interrompida.
Ambos sincronizam o card e encerram a Issue como **Not planned** via API do
GitHub. Done permanece reservado para trabalho entregue/concluído; Review,
Ready for Release e Done seguem recusados pelo CLI nesta rodada, sem automações
maiores da 2C.

A sandbox passou a simular o PATCH de encerramento Not planned e ganhou regressão
para os dois fluxos terminais. Validação local após a mudança:
**57 testes, 57 pass, 0 fail, 0 skipped**, em aproximadamente 115 segundos.
Nenhuma Feature real foi criada.

### Deploy e separação da Rodada 2C

O workflow `.github/workflows/deploy.yml` foi preservado. Na auditoria, o último
[deploy](https://github.com/gaydevs/gaydevs-platform/actions/runs/36479654739)
de main, commit `da1f4f0`, estava concluído com sucesso. O gatilho segue sendo
push em main/master com alteração de `frontend/**` ou do próprio workflow,
além de workflow_dispatch. Uma promoção só de infraestrutura SDD não dispara
esse deploy automaticamente. Nenhum deploy manual foi disparado nesta rodada.

A formulação anterior deste registro atribuía automações/release completos à
2B. O recorte autorizado os reservava à **2C**: PR → Project (Review, Ready for
Release, Done), fechamento de Issues após produção, automação completa de
release, teste final controlado e remoção do plano histórico. Esses itens ainda
não tinham sido implementados naquele checkpoint. Frontend/backend e adaptações
do Spec Kit foram preservados.

Referências das capacidades nativas:
[proteções](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches),
[CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
e [reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request).

## Rodada 2C — automação assistida de PR e release

A Issue #16 implantou o modelo simplificado aprovado para as transições finais:
GitHub Actions valida apenas o contrato de PR para `develop`, e a sincronização
de Project/Issue é feita por comandos versionados executados por agente ou gdev.
GitHub continua sendo a fonte da verdade; o agente não concede aprovação, review
ou merge.

A automação integral de cards por eventos privilegiados foi descartada
conscientemente. Ela exigiria infraestrutura e credenciais adicionais, como
GitHub App, tokens privilegiados de Project, políticas especiais e tratamento
seguro de eventos, um custo desproporcional para movimentar Status do Project.
O workflow adotado é SDD assistido: qualquer gdev pode pedir ao agente para
consultar a Issue/PR real e executar o script correto, ou rodar manualmente os
mesmos comandos sem IA.

Novos comandos:

```sh
node scripts/sdd/pr-check.mjs PR_NUMERO
node scripts/sdd/pr-sync.mjs PR_NUMERO
node scripts/sdd/release-sync.mjs PR_NUMERO
```

`.github/workflows/sdd-pr-check.yml` usa o evento normal `pull_request` para PRs
cuja base é `develop`, com permissões read-only (`contents`, `issues` e
`pull-requests`). Ele não usa `pull_request_target`, GitHub App, token
privilegiado de Project nem checkout do código do PR com credencial de escrita.
O check valida exatamente um `Refs #ID`, `Spec: NNNNN` quando houver spec,
Issue SDD elegível, correspondência entre spec e Issue e ausência de
`Closes`/`Fixes`/`Resolves` para a Issue. O check é guardrail automático de
consistência; a revisão de outro gdev em `develop` e a aprovação/merge
administrativa em `main` continuam gates humanos.

`pr-sync.mjs` valida o contrato do PR de trabalho e aplica somente as transições:

- PR aberto/reaberto para `develop`: `In Progress -> Review`;
- PR fechado sem merge: `Review -> In Progress`;
- PR mergeado em `develop`: `Review -> Ready for Release`, mantendo a Issue aberta.

Estados terminais `Rejected`, `Canceled` e `Done` são no-op. Estados
incompatíveis falham visivelmente, em vez de saltar etapas.

`release-sync.mjs` opera PR `develop -> main`. PR fechado sem merge é no-op.
Quando mergeado, o comando calcula o intervalo de commits entregue no release,
lista PRs mergeados com base `develop`, seleciona aqueles cujo
`merge_commit_sha` persistido pelo GitHub pertence ao intervalo, lê
`Refs #ID`/`Spec: NNNNN` dos próprios PRs de trabalho, revalida as Issues,
deduplica por número e finaliza somente Issues em `Ready for Release` com
Project Status `Done` e Issue `closed`/`completed`. Antes de finalizar as Issues, o comando faz back-sync do `merge_commit_sha` exato da release em `develop` pela API de merge do GitHub. A operação é merge, não reset: commits novos que já tenham entrado em `develop` são preservados, e uma falha no back-sync interrompe o comando antes de alterar Project/Issues. O corpo do PR de release
pode ficar vazio. O comando não depende de título, branch parecida, mensagem
livre de commit, data de merge nem `commits/{sha}/pulls` como mecanismo primário.

O repositório está configurado em Settings > General > Pull Requests com
Allow merge commits habilitado, Allow squash merging desabilitado e Allow rebase
merging desabilitado. Assim todos os PRs usam merge commit, garantindo a
premissa de rastreabilidade usada por `release-sync`; a validação de
`merge_commit_sha` segue como defesa adicional. Qualquer outro repositório que
adote esta infraestrutura SDD reutilizável deve reproduzir essa configuração de
merge, salvo se substituir explicitamente a estratégia de rastreabilidade por
outra equivalente.

`status.mjs` continua limitado a Backlog, Specifying, Ready, In Progress,
Rejected e Canceled. Review, Ready for Release e Done não foram liberados como
transições manuais arbitrárias; só os comandos assistidos as aplicam no contexto
de PR/release confiável. Sucesso de deploy não é pré-requisito para Done nesta
fase, e falha posterior de deploy não reabre Issue automaticamente.

Validação local da Rodada 2C neste checkout: `node scripts/sdd/test.mjs`
executou **81 testes: 81 pass, 0 fail, 0 skipped**, cobrindo o check read-only,
parser `Refs`/`Spec`, sincronização assistida de PR, release por
`merge_commit_sha`, múltiplas Issues, deduplicação, idempotência, estados
terminais e sandbox sem rede/writes reais. `git diff --check` deve permanecer
limpo antes da publicação do PR.
