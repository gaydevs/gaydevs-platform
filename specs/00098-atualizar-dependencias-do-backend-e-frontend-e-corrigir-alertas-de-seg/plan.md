# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/98 · Spec: [spec.md](spec.md)
Fast-track risk: Low

## Abordagem

1. Partir de `origin/develop` em worktree isolado para preservar checkouts existentes.
2. Executar `composer update --no-install --no-scripts --no-plugins` e `npm update`, sem alterar constraints, e comparar o diff dos lockfiles.
3. Executar `composer validate`, `composer audit --locked`, `npm audit`, lint, typecheck, testes e build do frontend.
4. Auditar os testes de polls existentes e o workflow `frontend-test.yml`; manter a suíte quando houver cobertura suficiente, sem testes redundantes.
5. Publicar um PR para `develop`, conferir os checks de backend e frontend no GitHub Actions e manter os gates humanos.

## Limites

- Lockfiles não substituem testes de integração; validar pelo CI Laravel com PHP compatível ao deploy.
- A auditoria contínua de `devDependencies` e a governança do Dependabot pertencem à #52.
- Alterações major ou modificações funcionais fora do escopo exigem reclassificação de risco.

## Aprovação

Fast-track solicitado pelo gdev em 2026-11-10 para esta Issue.

## Evidências de validação (2026-11-10)

- `composer validate --strict` e `composer audit --locked`: aprovados, zero advisories.
- `npm run lint`, `npm run typecheck`, `npm test` (130 de 130) e `npm run build`: aprovados.
- Workflow `Frontend Test` executa `npm test` e inclui os testes automatizados das polls.
- CI completo do PR #99: https://github.com/gaydevs/gaydevs-platform/actions/runs/42859342612 (todos os checks críticos passaram).
- `npm audit` incluindo `devDependencies` não produziu resposta na máquina Survivor e foi interrompido por timeout; esta verificação adicional permanece pendente. O workflow atual audita apenas dependências de produção e a política é discutida na #52.
