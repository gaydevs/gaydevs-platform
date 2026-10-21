# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/38 · Spec: [spec.md](spec.md)
Aprovação da spec: Luciano Vettoretti, 2026-10-20, nesta sessão.

## Abordagem
- Espelhar o backend com `frontend-lint.yml`, `frontend-audit.yml` e `frontend-test.yml` em todo push.
- Node 20 + `npm ci`; passos condicionados à existência de `frontend/package.json`.
- Lint: `lint`, `typecheck` e `check:content`; sem `CONTENT.md`, o último roda o baseline autocontido e preserva o audit editorial completo quando o arquivo aprovado é informado.
- Audit: `npm audit --omit=dev` em push e semanalmente.
- Test: Vitest 4.x com `--passWithNoTests` e 2 testes de `ActionLink` (externo/interno), sem jsdom/Testing Library.
- Remover o lint duplicado do workflow de deploy vigente.
- Após o primeiro push, exigir em `develop` e `main` os contextos reais dos três checks.

## Impactos e dependências
Somente CI, `frontend/package.json`/lock e o passo duplicado do deploy. Sem API, dados ou E2E. A #38 não depende da #29.

## Validação
Rodar lint, typecheck, check:content, audit, test e build; no GitHub confirmar os três checks e bloqueio de merge em `develop` quando um falhar.

## Constitution check
Spec aprovada; Issue #38 sem blockers; escopo e rastreabilidade preservados.

## Aprovação humana
Aprovado por Luciano Vettoretti em 2026-10-20, nesta sessão.


## Delta de escopo aprovado — 2026-10-20

2 testes simples de `ActionLink`, solicitados e aprovados explicitamente por Luciano Vettoretti nesta sessão.
