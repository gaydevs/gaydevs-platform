# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/20 · Spec: [spec.md](spec.md)
Aprovação da spec: gdev `luvittor`, 2026-10-14,
https://github.com/gaydevs/gaydevs-platform/issues/20#issuecomment-6175367492

## Abordagem

A fixture publica apenas os artefatos SDD da #20; não altera produto.

1. Abrir PR `techdebt/00020-* → develop` com `Refs #20` e `Spec: 00020`.
2. Executar `pr-sync` aberto (`In Progress → Review`) e, após review humano e
   merge commit, executar novamente (`Review → Ready for Release`).
3. Abrir release `develop → main` com body sem Issues; após aprovação
   administrativa e merge commit, executar `release-sync`
   (`Ready for Release → Done` e `completed`).

Review, aprovação e merge permanecem humanos; não haverá movimentação manual
de card para simular uma transição.

## Impactos e dependências

Sem frontend/backend, API, banco, migrations ou deploy. A #20 não tem blockers;
#17 e #19 ficam fora do teste. Project muda somente pelos comandos assistidos.

## Validação

- `node scripts/sdd/test.mjs` e `git diff --check` antes do PR.
- Check de contrato verde; nenhum diff funcional em `frontend/` ou `backend/`.
- Checklist registra os dois `pr-sync`, gates humanos, merge commits e
  `release-sync` descobrindo #20 por `merge_commit_sha`, não pelo body.

## Constitution check

- Issue, branch e spec usam o ID `00020`; há um worktree e uma spec.
- Escopo técnico aprovado; expansão exige nova aprovação.
- Spec aprovada; tasks/implementação aguardam aprovação deste plano.

## Aprovação humana

Pendente. Registrar gdev, data e referência antes de tasks/implementação.
