# Data Model

## SDD Issue

Fields:

- `number`: inteiro positivo; ID canonico da demanda.
- `paddedId`: numero com padding minimo de cinco digitos, por exemplo `00016`.
- `node_id`: ID GraphQL usado para Project v2.
- `state`: `open` ou `closed`.
- `state_reason`: `completed`, `not_planned`, `duplicate`, `reopened` ou `null`.
- `type.name`: um de `Feature`, `Bug`, `Refactor`, `Tech Debt`.
- `body`: deve conter `<!-- gaydevs-sdd:TIPO -->`.
- `projectStatus`: uma das opcoes em `.github/sdd.json`.

Validation rules:

- Deve passar por `sddIdentity(issue, { requireOpen })`.
- PR numbers sao recusados como Issue.
- `Rejected`, `Canceled` e `Done` sao terminais.
- `Rejected`/`Canceled` fecham como `not_planned`; `Done` fecha como `completed`.

Relationships:

- Uma SDD Issue pode ter uma spec `specs/NNNNN-slug/spec.md`.
- Uma SDD Issue e referenciada por um PR de trabalho via `Refs #ID`.
- Uma SDD Issue pode pertencer a um release quando o PR de trabalho rastreado foi
  integrado em `develop` e esta no intervalo entregue a `main`.

## PR Contract Reference

Fields:

- `refsIssue`: numero extraido de exatamente um `Refs #ID`.
- `specId`: ID extraido de exatamente um `Spec: NNNNN`, quando exigido.
- `hasClosingKeyword`: indica `Closes`, `Fixes`, `Resolves` ou variante proibida.
- `source`: body do PR validado como texto, nunca como comando.

Validation rules:

- `refsIssue` deve existir e ser unico.
- `specId`, quando exigido, deve existir, ser unico e corresponder a
  `refsIssue` com padding de cinco digitos.
- Closing keyword para a Issue e proibida em PR de trabalho para `develop`.
- Referencias ambiguas falham antes de qualquer write.

## Work Pull Request

Fields:

- `number`: numero do PR.
- `base.ref`: deve ser `develop`.
- `head.ref`: qualquer branch de trabalho; nao e fonte canonica de Issue.
- `body`: texto de rastreabilidade.
- `state`: aberto/fechado.
- `merged`: booleano da API.
- `merge_commit_sha`: commit gerado por **Create a merge commit** e persistido
  pelo GitHub.
- `contract`: `PR Contract Reference`.

Validation rules:

- Deve passar pelo parser `Refs`/`Spec`.
- A Issue referenciada deve ser SDD elegivel.
- PRs de trabalho para `develop` devem usar **Create a merge commit**; squash e
  rebase nao sao suportados no fluxo SDD de release.

Assisted transitions:

- Aberto/reaberto, Issue em `In Progress` -> `Review`.
- Fechado sem merge, Issue em `Review` -> `In Progress`.
- Mergeado em `develop`, Issue em `Review` -> `Ready for Release`.
- Estados terminais -> no-op.
- Estados nao terminais incompativeis -> erro visivel.

## Release Pull Request

Fields:

- `number`: numero do PR.
- `base.ref`: deve ser `main`.
- `head.ref`: deve ser `develop`.
- `state`: aberto/fechado.
- `merged`: booleano da API.
- `baseShaBeforeRelease`: commit de `main` antes do release.
- `deliveredSha`: commit entregue pelo merge do PR.

Validation rules:

- Fechado sem merge e no-op.
- Mergeado exige range comparavel por Git/GitHub.
- Nao exige lista manual de Issues no body.

Relationships:

- Contem zero ou mais `Release Candidate`, descobertos por merge commits de PRs
  de trabalho contidos no range entregue.

## Release Candidate

Fields:

- `issueNumber`: Issue SDD deduplicada.
- `workPrNumber`: PR de trabalho que introduziu a Issue em `develop`.
- `mergeCommitSha`: `merge_commit_sha` persistido no PR de trabalho e presente
  no conjunto de commits do release.
- `currentStatus`: Status relido antes da transicao.

Validation rules:

- PR associado deve ter sido mergeado em `develop`.
- `merge_commit_sha` do PR associado deve pertencer ao intervalo do release.
- PR associado deve ter contrato `Refs`/`Spec` valido.
- Issue deve ser SDD elegivel.
- Issue precisa estar em `Ready for Release` para virar `Done`.
- `Rejected`, `Canceled` e `Done` sao no-op/terminais, nao reclassificados.

## Assisted Sync Operation

Fields:

- `kind`: `pr-check`, `pr-sync` ou `release-sync`.
- `actor`: gdev ou agente executando script via `gh`.
- `target`: PR number.
- `writesProject`: `false` para `pr-check`, `true` para `pr-sync` e
  `release-sync`.
- `issueCloseReason`: `completed` apenas em `release-sync`.

Validation rules:

- GitHub atual e relido antes de agir.
- Inputs de PR/Issue sao dados, nunca comandos.
- Writes ocorrem somente depois de validacao completa.
- Reexecucao deve ser idempotente.

State matrix:

| Entity | Current | Operation | Result |
| --- | --- | --- | --- |
| Work PR contract | any | `pr-check` | pass/fail, sem writes |
| SDD Issue | `In Progress` | `pr-sync` open/reopened | `Review` |
| SDD Issue | `Review` | `pr-sync` closed unmerged | `In Progress` |
| SDD Issue | `Review` | `pr-sync` merged to develop | `Ready for Release` |
| SDD Issue | `Ready for Release` | `release-sync` merged release | `Done` + closed/completed |
| SDD Issue | `Rejected`/`Canceled`/`Done` | any sync | no-op |
