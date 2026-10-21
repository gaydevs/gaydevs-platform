# Contribuir

gdevs podem usar qualquer agente de IA (altamente recomendável, mas opcional).
Pré-requisitos: Git, Node.js 20+, GitHub CLI e PowerShell 7 para os helpers do Spec Kit.

```sh
gh auth login
gh auth status
gh repo set-default gaydevs/gaydevs-platform
gh auth refresh -s project
```

O [Project](https://github.com/orgs/gaydevs/projects/1) é privado; `gdevs-team`
tem Write. `admin:org` só é necessário para administrar tipos/campos da
organização, não para a rotina de movimentação de cards.

Crie uma Issue pelo form Feature, Bug, Refactor ou Tech Debt, na interface ou
por agente seguindo [AGENTS.md](AGENTS.md). Defina Priority e dependências nativas.

```sh
node scripts/sdd/from-issue.mjs 27         # consultar, sem alterar
node scripts/sdd/from-issue.mjs 27 --start # iniciar após verificar contexto
```

Feature sempre usa o fluxo normal. Bug/Refactor/Tech Debt realmente triviais podem
usar `--fast-track --human-approved`; `--trivial` permanece como alias compatível e
exige a mesma aprovação explícita. O fast-track ainda gera `spec.md`, `plan.md` e
`tasks.md`, mas sucintos e sem aprovações intermediárias. Fora dele: aprovar spec →
elaborar plan → aprovar plan → tasks → código. Se o escopo crescer, expandir os
artefatos e voltar a Specifying na mesma branch.
Após publicar a branch, `node scripts/sdd/pr-create.mjs` cria o PR para
`develop` com `Refs #ID` e `Spec: NNNNN` quando houver spec. `--title` e `--body`
são opcionais; o comando valida o texto adicional e não faz push. PRs manuais
continuam permitidos com as mesmas referências. Não use `Closes`, `Fixes` ou
`Resolves` para fechar Issues SDD. O check `SDD PR contract` valida o contrato,
mas não substitui a revisão humana: solicite revisão de outro gdev. Use
**Create a merge commit**; squash e rebase ficam desabilitados neste repo para
preservar a rastreabilidade de release.
Consulte o [fluxo](docs/development-workflow.md) e o
[estado desta implantação](docs/sdd-implementation.md) antes de iniciar.

As proteções exigem PR, uma aprovação atualizada e conversas resolvidas também
para admins. O team `gdevs-admins` tem Admin no repo; `gdevs-team` mantém Write.
A promoção `develop → main` tem merge restrito aos admins; a aprovação de um
membro de `gdevs-admins` via CODEOWNERS depende de esse arquivo já estar em `main`.
Com um único membro no team administrativo, outro gdev abre a promoção para
que esse membro possa aprová-la.

Validação do tooling: `node scripts/sdd/test.mjs`.
A [suíte sandbox](docs/sdd-sandbox.md) usa Git/PowerShell reais e GitHub simulado,
sem credenciais ou rede, com fixtures descartáveis e limpeza após falhas.
Comandos do frontend permanecem no [README](README.md).

Comandos SDD finais de rotina:

```sh
node scripts/sdd/pr-check.mjs 123
node scripts/sdd/pr-sync.mjs 123
node scripts/sdd/release-sync.mjs 456
```

O check é automático e read-only em PRs para `develop`. `pr-sync` e
`release-sync` são automação assistida: um agente de IA pode executá-los, ou um
gdev pode rodar os mesmos comandos manualmente. GitHub continua sendo a fonte
da verdade; gates humanos de spec, plan, review e release continuam humanos.
