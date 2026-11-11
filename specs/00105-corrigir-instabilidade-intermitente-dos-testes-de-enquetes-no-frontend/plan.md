# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/105

1. Reproduzir o cenário com os testes atuais em `PollsPage.test.tsx`.
2. Identificar vazamentos de mocks e efeitos assíncronos.
3. No arquivo de testes, substituir a limpeza parcial por reset completo
   das implementações enfileiradas; restaurar `pollErrorMessage` no
   setup, pois esse mock tem retorno padrão esperado por cenários de erro.
4. Validar `PollsPage.test.tsx`, suíte completa e repetição da suíte.
5. Commit e PR para develop, com evidências; sem alterar produção.

Risco Low: mudança limitada a isolamento de testes e documentação SDD.

## Evidências de validação (Survivor)

- Testes `PollsPage.test.tsx`: 4 execuções consecutivas, **57/57** aprovados em cada uma.
- `npm run lint` e `npm run typecheck`: aprovados.
- `npm test` com 20 workers de isolamento no Survivor: **128/130** aprovados;
  ocorreram timeouts de 5 segundos em `App.test.tsx` e `useAuth.test.tsx`.
- `npm test -- --maxWorkers=4`: **129/130** aprovados; timeout em
  `App.test.tsx`. Apesar de limitar concorrência, o runner continuou criando
  20 workers isolados e a suíte levou ~120 segundos no hardware do Survivor.
- Ambos os runs **aprovaram todos os 57 testes de `PollsPage.test.tsx`**;
  os timeouts observados são em testes fora do escopo da alteração. Não são
  aceites para CI: aguardar o GitHub Actions completo verde.
- Não foram alterados limites globais de timeout, workflows nem código de produção.
