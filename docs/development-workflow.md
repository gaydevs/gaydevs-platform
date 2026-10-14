# Fluxo de trabalho

Issue → spec (o quê) → plan (como) → tasks (execução) → código → PR para develop
→ release para main → produção. Cada gdev escolhe seu agente; IA é opcional e
altamente recomendável. O processo também funciona executando os comandos manualmente.

1. Crie a Issue na interface com o form correto ou peça ao agente. Feature exige
   spec; Bug, Refactor e Tech Debt exigem quando não triviais. Team Access, outros
   forms e Issues sem form ficam fora. Os forms SDD têm um marcador no body e tipo
   nativo correspondente; ambos são exigidos pelos scripts.
2. Consulte `node scripts/sdd/issue.mjs 27`: body, tipo, labels, responsáveis,
   comentários, Priority e relações blocked by / blocking vêm do GitHub atual.
   `node scripts/sdd/from-issue.mjs 27` também permite consultar Issues bloqueadas,
   sem alterar arquivos, branches ou Project. Blockers impedem início, não leitura.
3. Inicie com `node scripts/sdd/from-issue.mjs 27 --start`. O checkout deve estar
   limpo. O comando verifica blockers, busca `origin/develop`, cria branch e
   rascunho da spec, atualiza Project e comenta a Issue. Não publica a branch.
   Se falhar após criar a branch, inspecione os efeitos e retome; não recrie IDs.
4. `#27` vira `00027`. Branches: `feat/00027-slug`, `fix/00027-slug`,
   `refactor/00027-slug`, `techdebt/00027-slug`. Uma pasta `specs/00027-slug/`
   atende frontend e backend. Ao retomar, entre na branch existente e releia a
   Issue via `issue.mjs`. Os helpers usam o ID da branch deste worktree para
   localizar exatamente uma pasta `specs/NNNNN-*`; ausência ou ambiguidade é erro.
5. Sintetize a spec; o rascunho não é uma spec pronta. Um gdev aprova spec antes
   do plan e plan antes das tasks/implementação. Registre a aprovação e sua origem
   nos artefatos. Tasks ficam em `tasks.md`, sem Issues automáticas por task.
6. PR para `develop`: resumo, testes, critérios de aceite, riscos relevantes,
   `Refs #27` e, quando houver spec, `Spec: 00027`. Não use `Closes`, `Fixes`
   ou `Resolves` para a Issue SDD nesse PR. O check `SDD PR contract` valida
   automaticamente esse contrato, mas a revisão de outro gdev continua sendo
   o gate humano antes do merge. Use **Create a merge commit**.
7. Depois do PR aberto, mergeado ou fechado, um agente/gdev executa
   `node scripts/sdd/pr-sync.mjs PR_NUMERO` para sincronizar o Project.
   Merge em `develop` deixa a Issue aberta em `Ready for Release`.

O contexto local vem da branch Git; Issue, comentários, Priority e dependências
devem ser relidos do GitHub. Não há ponteiro global nem cache de Issue. Resíduos
antigos de `.specify/feature.json` e `.specify/context/` são ignorados e nunca
consultados ou atualizados. Use worktrees separados para trabalhos simultâneos:
trocar a branch de um checkout muda o HEAD para todos os processos nele.

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
O agente não deve usar a opção sem evidência humana. Um trabalho trivial não
precisa dos gates de spec/plan; sua classificação e início precisam estar acordados.

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
