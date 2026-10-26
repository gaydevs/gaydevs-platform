# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/60 · Spec: [spec.md](spec.md)

## Abordagem

- Manter a lógica atual de audit, lint e testes, expondo os seis workflows como reutilizáveis via `workflow_call`.
- Criar um workflow `CI` disparado em `push` que chama esses workflows e concentra a execução obrigatória.
- Adicionar o job estável `CI Required`, executado com `always()`, que só retorna sucesso quando todos os workflows obrigatórios terminarem com `success`; `failure`, `cancelled` e `skipped` falham o gate.
- Documentar o status check `CI / CI Required` como o único check de build/teste a ser configurado como obrigatório na branch protection.

## Validação

Validar sintaxe dos workflows, exercitar a lógica do gate com resultados de sucesso/falha/skip/cancelamento, executar `git diff --check` e os testes SDD relevantes.

## Aprovação

Fast-track aprovado por um gdev antes da implementação. Esta aprovação cobre spec, plan e início da implementação enquanto o trabalho permanecer trivial.
