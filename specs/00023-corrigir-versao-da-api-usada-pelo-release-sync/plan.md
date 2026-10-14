# Plano — 00023

## Abordagem

1. Confirmar temporariamente, contra o PR #22, a resposta atual e a compatível; descartar o teste.
2. Manter a versão global e implementar fallback compatível apenas em `readPullRequest` quando o SHA vier nulo.
3. Cobrir leitura normal, fallback e falha sem SHA na sandbox.
4. Executar a sandbox e `git diff --check`.
5. Após merge em `develop`, rerodar `release-sync 22` para finalizar somente #16 e #20; a correção segue na promoção seguinte para `main`.

## Arquivos

- `scripts/sdd/core.mjs`
- `scripts/sdd/sandbox/fake-gh.cjs`
- testes SDD afetados

## Riscos

- A mudança é global para chamadas REST; a sandbox valida o cabeçalho e o fluxo de release.
- O rerun do release histórico só ocorre após validação e merge humano.

## Aprovação humana

Aprovado por luvittor em 2026-10-14 nesta conversa, incluindo o fallback restrito.
