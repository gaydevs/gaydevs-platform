# Fluxo de trabalho

Fluxo normal: Issue → spec (o quê) → plan (como) → tasks (execução) → código →
PR para develop → release para main → produção. O risk-based fast-track mantém a
mesma rastreabilidade e ajusta os gates ao risco: Low segue após uma aprovação
inicial, Medium exige um checkpoint humano adicional antes da implementação e High
usa o fluxo normal. Cada gdev escolhe seu agente; IA é opcional e altamente
recomendável. O processo também funciona executando os comandos manualmente.

1. Crie a Issue na interface com o form correto ou peça ao agente. Feature, Bug,
   Refactor e Tech Debt usam uma spec; no fast-track ela é gerada em formato sucinto.
   Team Access, outros forms e Issues sem tipo SDD ficam fora. Risk e Priority são
   conceitos independentes: prioridade não autoriza nem bloqueia fast-track.
2. Consulte `node scripts/sdd/issue.mjs 27`: body, tipo, labels, responsáveis,
   comentários, Priority e relações blocked by / blocking vêm do GitHub atual.
   `node scripts/sdd/from-issue.mjs 27` também permite consultar Issues bloqueadas,
   sem alterar arquivos, branches ou Project. Blockers impedem início, não leitura.
3. Inicie o fluxo normal com `node scripts/sdd/from-issue.mjs 27 --start`. Para
   fast-track já classificado e aprovado por um gdev, use Low Risk com
   `node scripts/sdd/from-issue.mjs 27 --start --fast-track --risk low --human-approved`
   ou Medium Risk trocando `low` por `medium`. `--trivial` permanece como alias legado
   de Low Risk. High Risk não aceita fast-track. O checkout deve estar limpo. O helper
   verifica blockers, parte de `origin/develop` sem upstream, atualiza Project e
   comenta a Issue; no normal cria o rascunho da spec, e no fast-track cria
   `spec.md`, `plan.md` e `tasks.md` sucintos. Não publica a branch.
4. `#27` vira `00027`. Branches: `feat/00027-slug`, `fix/00027-slug`,
   `refactor/00027-slug`, `techdebt/00027-slug`. Uma pasta `specs/00027-slug/`
   atende frontend e backend. Ao retomar, entre na branch existente e releia a
   Issue via `issue.mjs`. Os helpers usam o ID da branch deste worktree para
   localizar exatamente uma pasta `specs/NNNNN-*`; ausência ou ambiguidade é erro.
5. No fluxo normal, sintetize a spec; o rascunho não é uma spec pronta. Um gdev
   aprova spec antes do plan e plan antes das tasks/implementação. No Low Risk, a
   aprovação inicial cobre esses gates e a Issue entra em In Progress. No Medium,
   os três artefatos sucintos são gerados, mas a Issue permanece em Specifying até
   um gdev aprovar `node scripts/sdd/fast-track.mjs 27 checkpoint --human-approved`;
   só então ela entra em In Progress. High Risk segue o fluxo normal. Arquitetura
   relevante, autenticação/autorização sensível, segurança/privacidade, migrations
   destrutivas, contratos de alto impacto ou escopo incerto são High Risk por padrão.
   Se o risco aumentar, pare a implementação e use `fast-track.mjs 27 escalate
   medium|high`; a mesma branch/spec é preservada. Medium passa a exigir checkpoint;
   High exige expandir os artefatos e retomar os gates normais. Tasks ficam em
   `tasks.md`, sem Issues automáticas.
6. A branch criada por `from-issue --start` ainda não possui upstream. Faça a
   primeira publicação explicitamente e só depois crie o PR para `develop`:

   ```sh
   git push -u origin HEAD
   node scripts/sdd/pr-create.mjs --title "Resumo do trabalho" --body "Resumo, testes e riscos relevantes."
   ```

   O primeiro comando cria a branch remota de mesmo nome e passa a rastreá-la.
   Não use `git push` sem destino para tentar publicar uma branch SDD inédita.
   O título do PR é opcional (por padrão usa o da Issue), assim como o texto adicional.
   O comando resolve `Refs #ID` e `Spec: NNNNN` pela branch/Issue/spec e falha
   diante de conteúdo conflitante; não faz push. PR manual continua permitido,
   desde que informe as mesmas referências. Não use `Closes`, `Fixes` ou
   `Resolves` para a Issue SDD nesse PR. O check `SDD PR contract` valida o
   contrato, mas a revisão de outro gdev continua sendo o gate humano antes do
   merge. Use **Create a merge commit**.
7. Depois do PR aberto, mergeado ou fechado, um agente/gdev executa
   `node scripts/sdd/pr-sync.mjs PR_NUMERO` para sincronizar o Project.
   Merge em `develop` deixa a Issue aberta em `Ready for Release`.

O contexto local vem da branch Git; Issue, comentários, Priority e dependências
devem ser relidos do GitHub. Não há ponteiro global nem cache de Issue. Resíduos
antigos de `.specify/feature.json` e `.specify/context/` são ignorados e nunca
consultados ou atualizados.

Para um único trabalho, use o checkout existente e sua branch SDD; não crie um
worktree auxiliar. Crie outro worktree somente quando trabalhos simultâneos
exigirem checkouts em branches diferentes, pois trocar a branch de um checkout
muda o HEAD para todos os processos nele. Antes de criar, use `git worktree list`
e procure a branch/spec da Issue para retomar o trabalho existente.

Após merge ou abandono, confira o worktree com `git -C CAMINHO status --short`.
Preserve, faça commit ou descarte conscientemente qualquer alteração necessária;
somente então use `git worktree remove CAMINHO`. A limpeza é uma ação explícita
do gdev e nunca deve remover automaticamente um checkout com trabalho pendente.

Para automação/CI, `SPECIFY_FEATURE_DIRECTORY` aceita uma pasta existente, absoluta
ou relativa à raiz do projeto, somente no ambiente da execução. Nunca use `setx`,
perfil de shell ou configuração persistente. Exemplo em um processo PowerShell
filho, após aprovação da spec:

```powershell
pwsh -NoProfile -Command '$env:SPECIFY_FEATURE_DIRECTORY = "specs/00027-slug"; & ./.specify/scripts/powershell/setup-plan.ps1 -Json'
```

O processo seguinte volta a resolver pela própria branch. `SPECIFY_FEATURE` não
é suportado e causa erro explícito, mesmo com override de diretório. Em detached
HEAD ou sem Git, o override de diretório é obrigatório. Os helpers não concedem
aprovação humana; preservam os gates de spec e plan.

O board é [gaydevs project](https://github.com/orgs/gaydevs/projects/1), privado
da organização. Membros têm Read, `gdevs-team` Write e owners Admin. Fluxo normal:
Backlog → Specifying → Ready → In Progress → Review → Ready for Release → Done.
Encerramentos alternativos: Backlog/Specifying → Rejected; Ready/In Progress/
Review/Ready for Release → Canceled.
Confira no [registro da implantação](sdd-implementation.md) quais recursos estão
ativos. Na rotina, agente/scripts devem atualizar o board via gh; arrastar cards
é uma exceção. A automação integral de cards por eventos privilegiados foi
descartada por complexidade desproporcional; o modelo adotado é automação
assistida por agente/gdev executando scripts versionados.

O auto-add nativo inclui Issues dos tipos Feature, Bug, Refactor e Tech Debt
do `gaydevs-platform`, com Status inicial Backlog. Outros tipos, Team Access
(sem tipo no form atual), Issues sem tipo e PRs ficam fora. A inclusão é
assíncrona; confira o card antes de presumir sincronização. Para uma Issue nova
elegível que ainda não entrou, use `node scripts/sdd/status.mjs NUMERO Backlog`.
Esse fallback via gh exige também o marcador do form. Não use Backlog para
reiniciar o Status de trabalho já em andamento. O auto-add não remove cards
existentes quando o tipo muda; revise esses casos explicitamente.

Priority é o campo nativo da organização, compartilhado pela Issue e pelo
Project, com High, Medium e Low. Não crie uma segunda prioridade no board.

```sh
node scripts/sdd/priority.mjs 27 Medium
node scripts/sdd/dependency.mjs add 27 12    # 27 blocked by 12
node scripts/sdd/dependency.mjs remove 27 12
node scripts/sdd/status.mjs 27 Ready --human-approved
node scripts/sdd/status.mjs 27 "In Progress" --human-approved
node scripts/sdd/status.mjs 27 Rejected
node scripts/sdd/status.mjs 27 Canceled
```

`--human-approved` declara aprovação recebida; não a concede nem a verifica em
um sistema de identidade. Blockers abertos impedem início/Ready/In Progress.
O agente não deve usar a opção sem evidência humana. Em `from-issue`, fast-track
exige `--risk low|medium` e essa flag, registra o Risk na spec/Issue e gera
spec/plan/tasks sucintos. Low pode seguir até PR sem outros gates intermediários;
Medium exige exatamente um checkpoint humano antes da implementação. Review e merge
continuam humanos. `fast-track.mjs ISSUE escalate medium|high` aumenta a governança
sem criar outra branch/spec; High encerra o fast-track e retoma o SDD normal.

Nesta rodada, `status.mjs` opera Backlog, Specifying, Ready, In Progress,
Rejected e Canceled. Rejected registra uma demanda analisada e decidida como
não sendo feita; Canceled registra uma demanda anteriormente aceita/iniciada e
depois interrompida. Ambos atualizam o Project e encerram a Issue como
**Not planned**. Review, Ready for Release e Done continuam reservados às
transições dirigidas por `pr-sync.mjs` e `release-sync.mjs`; `status.mjs` não
libera essas transições como comandos manuais arbitrários. Nenhuma movimentação
de card equivale a aprovação humana.

Comandos finais de PR/release:

```sh
node scripts/sdd/pr-check.mjs 123      # valida contrato SDD do PR
node scripts/sdd/pr-create.mjs --title "Resumo" --body "Contexto adicional" # cria PR da branch atual
node scripts/sdd/pr-sync.mjs 123       # PR de trabalho -> Review/In Progress/Ready for Release
node scripts/sdd/release-sync.mjs 456  # release develop -> main -> Done + completed
```

`pr-sync.mjs` consulta o PR real, valida `Refs`/`Spec` e só aplica:
In Progress → Review, Review → In Progress em close sem merge, ou
Review → Ready for Release em merge para `develop`. Estados terminais
Rejected/Canceled/Done são no-op.

`release-sync.mjs` opera PR `develop → main` já fechado. Se o PR foi fechado sem
merge, não altera nada. Se foi mergeado, descobre as Issues pelo conjunto de
commits do release e pelos PRs de trabalho mergeados em `develop` cujo
`merge_commit_sha` persistido pelo GitHub está nesse intervalo. O corpo do PR
de release pode ficar vazio; o comando não usa título, branch parecida,
mensagem livre de commit ou data como heurística. Ele deduplica por Issue,
finaliza apenas Issues em `Ready for Release`, move para Done e fecha como
completed. Deploy não é pré-requisito para Done nesta fase, e falha posterior
de deploy não reabre Issue automaticamente.

Com Project indisponível, `--without-project` permite iniciar com aviso explícito
de sincronização pendente. Não equivale a card criado. Depois sincronize via
`status.mjs`; para um rascunho use `Specifying`.

### Gate agregado de CI

Os checks de audit, lint e testes de backend/frontend são orquestrados por
`.github/workflows/ci.yml`. Em cada `push`, o workflow `CI` chama os workflows
reutilizáveis e publica o job final **`CI Required`**. Esse job usa `needs` para
aguardar todos os checks obrigatórios e falha se qualquer resultado for diferente
de `success`, incluindo `failure`, `cancelled` ou `skipped`.

Na proteção de branch, habilite **Require status checks to pass before merging**
e selecione exclusivamente o status check **`CI Required`**. Os checks
internos continuam visíveis para diagnóstico, mas não precisam ser cadastrados
individualmente. CodeRabbit e `SDD PR contract` não fazem parte desse agregado,
pois não são checks universais de `push`; se algum deles passar a ser gate de merge,
deve ser configurado separadamente.

Fluxo Git: `feat/fix/refactor/techdebt → develop → main → produção`.
As proteções clássicas de `develop` e `main` exigem PR, uma aprovação atualizada
e resolução das conversas, inclusive para admins. Novos diffs invalidam aprovações;
force push e exclusão estão bloqueados. O GitHub impede aprovação pelo autor.
Em `develop`, outro gdev com Write pode aprovar; não é exigida aprovação de admin.

`main` representa produção. Sua restrição de atualização reserva o merge aos
admins; a lista explícita contém o team `gdevs-admins`, com acesso Admin ao repo.
`gdevs-team` mantém Write. A proteção também exige code owner: um membro de
`gdevs-admins` deve aprovar. Essa exigência só identifica o team quando o arquivo
`.github/CODEOWNERS` estiver na própria `main`. Consulte o registro da implantação
para saber se esse bootstrap já foi integrado. Outros gdevs podem deixar reviews;
depois do bootstrap, suas aprovações não substituem a aprovação do code owner.

A promoção normalmente parte de `develop`; a proteção clássica não restringe
a branch de origem do PR. O admin deve conferir origem, diff e aprovação antes
do merge. Enquanto houver um único membro em `gdevs-admins`, outro gdev precisa
abrir o PR de promoção para que esse membro possa aprová-lo. No primeiro PR que
instalar CODEOWNERS em `main`, a aprovação administrativa ainda precisa ser conferida
manualmente. Não usar bypass ou autoaprovação para completar o bootstrap.
Gerencie a composição administrativa pelo team `gdevs-admins`; mudanças de
membros não exigem editar CODEOWNERS ou as listas de restrição de `main`.
O team deve permanecer Visible e com Admin no repo. Admins externos ao team
mantêm acesso nativo de atualização, mas não substituem o code owner exigido.

Para preservar o histórico do checkpoint, de PRs de trabalho e da promoção, usar
**Create a merge commit**. O repositório está configurado com Allow merge commits
habilitado e squash/rebase desabilitados. Qualquer outro repositório que adote
esta infraestrutura SDD reutilizável deve reproduzir essa configuração, salvo se
substituir explicitamente a estratégia de rastreabilidade de releases por outra
equivalente. Aprovação e merge continuam humanos; nenhuma automação aprova,
revisa ou mergeia PRs. Rejected e Canceled são os encerramentos Not planned.
O deploy existente roda em pushes de main/master que alterem frontend ou o
workflow de deploy, além de disparo manual; nem todo merge dispara deploy.
