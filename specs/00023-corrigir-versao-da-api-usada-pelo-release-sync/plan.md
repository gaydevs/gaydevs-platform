# Plano — 00023

## Abordagem

1. Confirmar temporariamente, contra o PR #22, a resposta atual e a compatível; descartar o teste.
2. Manter a versão global e implementar fallback compatível apenas em `readPullRequest` quando o SHA vier nulo.
3. Aplicar o mesmo fallback restrito em `listPullRequests` somente quando houver PR mergeado sem SHA.
4. Cobrir leitura, listagem, fallback e falha sem SHA na sandbox.
5. Executar a sandbox e `git diff --check`.
6. Após merge em `develop`, abrir nova promoção para `main` e sincronizá-la com as exclusões explícitas necessárias.

## Ampliação: exclusões explícitas

1. Aceitar `--exclude-issue NUMERO` repetível; rejeitar argumentos inválidos.
2. Identificar as referências dos PRs entregues antes de validá-las como SDD; excluir somente os números informados.
3. Falhar antes de escritas se uma exclusão não aparecer no release.
4. Registrar as exclusões no resultado e cobrir uma ou mais exclusões na sandbox.

## Arquivos

- `scripts/sdd/core.mjs`
- `scripts/sdd/sandbox/fake-gh.cjs`
- testes SDD afetados

## Riscos

- A mudança é global para chamadas REST; a sandbox valida o cabeçalho e o fluxo de release.
- O rerun do release histórico só ocorre após validação e merge humano.

## Ampliação: fallback da listagem

1. Repetir a listagem somente quando um PR mergeado não trouxer SHA na API atual.
2. Preservar a resposta atual quando todos os SHAs estiverem presentes.
3. Cobrir ambas as versões da chamada na sandbox.

## Aprovação humana

Autorização excepcional de luvittor em 2026-10-14: preparar esta ampliação, seus artefatos e código antes do checkpoint humano único pré-commit.
