# Pesquisa técnica — #00080

## Decisões

- Seguir o padrão de Actions já usado em `backend/app/Actions` para operações de escrita. `RequestLoginOtp` e `VerifyLoginOtp` mostram que controllers podem injetar casos de uso pequenos.
- Manter consultas de leitura em um componente de Polls focado. `PollService` hoje combina paginação/cursor, consultas, mutações e serialização; não é necessário acrescentar repository layer para separar esses papéis.
- Montar payloads com o contexto do gdev passado explicitamente. A leitura atual de `Auth::guard('sanctum')` está dentro de `PollService::payload()`; a nova fronteira de apresentação não deve depender desse estado global.
- Reutilizar Eloquent eager loading em coleções para hidratar os polls de uma página/lote e agrupar votos uma vez por opção. A relação `activeVotes.user` só é necessária quando os nomes forem expostos.
- Manter as transações e locks nos casos de uso de escrita. Os testes atuais já exercitam concorrência MySQL em OTP; a área de votação também precisa manter seus locks e ser verificada nessa base.

## Alternativas descartadas

- Repositórios/interfaces sobre Eloquent: não existe uma necessidade de troca de persistência que justifique essa camada.
- Reescrita geral antes de validar: torna difícil atribuir regressões e conflita com a estratégia inicial de caracterização antes da produção.
- Fixar metas absolutas de latência: resultados dependem de host e dados. A regressão deve medir consultas por requisição e demonstrar que não há consulta por enquete/opção, sem criar um benchmark instável.

## Lacunas e contexto

O código e os testes de `develop` foram lidos localmente. A cobertura existente já protege criação, fechamento, votos, opções, autorização, paginação/cursor, sync incremental, payload público/autenticado e auditoria. A lacuna confirmada é um teste com `since` e `limit` menor que o número de resultados; o teste atual tem apenas dois resultados e usa o limite padrão de três.

Não há decisão pendente de biblioteca externa nem necessidade de migration. A base de implementação continua Laravel/Eloquent e Composer atuais.

## Ajuste aprovado de histórico

A caracterização de `since` com `limit` foi criada localmente antes da produção no commit `847a12f`. A branch publicada foi consolidada e o primeiro commit da PR (`843a18b`) reúne testes e produção; `847a12f` não é ancestral remoto. Gdev `luvittor` aprovou em 2026-10-29 registrar essa exceção para a #80, mantendo o teste e as validações finais sem reescrever o histórico.
