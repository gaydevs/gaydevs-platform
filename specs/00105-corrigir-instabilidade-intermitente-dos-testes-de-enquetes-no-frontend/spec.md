# 00105 — Corrigir instabilidade intermitente dos testes de enquetes no frontend

Issue: https://github.com/gaydevs/gaydevs-platform/issues/105
Fast-track: **Low Risk**, aprovado pelo gdev no pedido de 2026-11-10.
Branch: fix/00105-corrigir-instabilidade-intermitente-dos-testes-de-enquetes-no-frontend

## Contexto e reprodução

No CI de develop, os testes `PollsPage.test.tsx` falharam em 3 cenários
de carregamento incremental e refresh. O mesmo commit passou na segunda
tentativa, sem mudanças no código. Evidência:
https://github.com/gaydevs/gaydevs-platform/actions/runs/42927624050/attempts/1

A revisão da implementação encontrou `afterEach(vi.clearAllMocks())`
com várias respostas de API enfileiradas por `mockResolvedValueOnce` e
`mockReturnValueOnce`. `clearAllMocks` zera o histórico de chamadas, mas
**não** descarta implementações ou respostas pendentes. A terceira falha,
que recebeu dados de enquetes do teste anterior, é compatível com esse
vazamento entre testes.

## Mudança esperada

- Isolar as respostas e implementações de mocks em cada teste
  com `vi.resetAllMocks`; preservar os defaults necessários do arquivo.
- Não modificar produção, chamadas reais à API ou a lógica de enquetes.
- Não mascarar falhas com retries genéricos no CI nem aumentar timeouts.

## Critérios de aceite

- Testes específicos e suite completa do frontend passam repetidamente.
- Os mocks não conservam `mock*Once` de testes anteriores.
- ESLint, typecheck e checks de PR passam.
- PR para develop; review humano necessário antes de merge.
