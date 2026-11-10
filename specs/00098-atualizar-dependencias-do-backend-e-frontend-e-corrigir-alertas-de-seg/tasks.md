# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/98 · Plano: [plan.md](plan.md)

- [x] T001 Criar Issue Tech Debt #98 com Priority High e fast-track Low em branch própria.
- [x] T002 Atualizar os lockfiles: 32 pacotes Composer, atualizações npm dentro dos constraints, sem alteração funcional.
- [x] T003 Validar `composer validate --strict` e `composer audit --locked`: sem advisories; Backend Audit no CI verde.
- [x] T004 Frontend: lint, typecheck, 130 testes em 20 arquivos, build e Frontend Audit de produção no CI verdes. A suíte inclui 68 casos dedicados a polls (listagem, detalhe, votos, erros, loading e autorização).
- [x] T005 Publicar PR #99 para develop; CI Required e SDD PR contract aprovados; Issue em Review, sem merge/deploy automático.
- [ ] T006 Concluir verificação independente de `npm audit` incluindo devDependencies: consulta no Survivor excedeu timeout em duas tentativas. Auditoria de produção do CI passou; a estratégia contínua de devDependencies é objeto da Issue #52. O reviewer deve avaliar a pendência antes de promover a release.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
