# 00080 — Modularizar o backend de enquetes e reduzir responsabilidades do PollService

Issue: https://github.com/gaydevs/gaydevs-platform/issues/80
Estado: spec e plano aprovados por gdev luvittor em 2026-10-28; execução autorizada.

## Problema e objetivo

O módulo de enquetes concentra consultas, regras de escrita, paginação, sugestões, auditoria e serialização em `PollService`. Isso torna mudanças pequenas difíceis de localizar e testar, e a listagem resolve cada enquete separadamente e percorre os votos repetidamente ao montar opções.

Esta refatoração deve separar essas responsabilidades em limites coesos e reduzir o trabalho repetido na leitura. Para gdevs e consumidores da API, o comportamento existente deve permanecer idêntico: o escopo é interno, sem alteração de rotas, payloads, regras, ordenação ou banco.

## Escopo e comportamento

Inclui a reorganização dos fluxos de leitura e escrita de enquetes, a apresentação dos payloads e da auditoria, e os caminhos de paginação/cursor e sincronização incremental. A implementação deve manter separadas as decisões de autenticação da lógica que constrói dados de resposta, sem introduzir camadas genéricas sem necessidade.

As respostas da API devem manter rotas, status HTTP, campos, valores, ordenação e regras de autorização atuais. Permanecem iguais a criação e encerramento de enquetes, mudanças de votos, criação/ocultação de opções, sugestões, histórico de auditoria e distinção entre respostas anônimas e autenticadas.

O caminho `since` continua retornando todos os polls alterados na janela atual, sem aplicar o limite usado na listagem paginada. Alterar essa semântica exigiria uma demanda de contrato separada. A resposta anônima mantém contagens e percentuais, sem nomes de votantes; esses nomes só são necessários nas respostas autenticadas que os expõem.

Estão fora do escopo mudanças de frontend, rotas ou contratos HTTP, regras de produto, autenticação/autorização, esquema de dados e migrations. A divisão ou renomeação dos arquivos de teste só ocorre sem perda de cobertura e em etapa separada das extrações de produção.

Antes de qualquer mudança de produção, o primeiro commit de implementação será somente de testes de caracterização, verdes contra o código atual. A cobertura existente já é ampla; a lacuna confirmada é o contrato de sincronização incremental: `since` retorna todos os polls alterados mesmo quando `limit` é menor que a quantidade retornada. Asserções de desempenho que falhem no código atual serão introduzidas junto com a implementação que as satisfaz, sem deixar um commit intermediário vermelho.

## Requisitos verificáveis

- REQ-001: O módulo de enquetes não mantém um componente único responsável por consultas, mutações, paginação e serialização; cada responsabilidade fica em uma fronteira pequena e testável.
- REQ-002: Casos de uso de escrita mantêm as mesmas regras, transações, respostas e decisões de autorização existentes.
- REQ-003: Leitura e serialização não dependem de consultar implicitamente `Auth::guard()` dentro do serviço de aplicação/domínio; o contexto do gdev é explícito quando necessário.
- REQ-004: Listagens carregam enquetes e relações em lote, sem uma resolução/consulta individual por enquete; cálculos por opção não percorrem toda a coleção de votos repetidamente.
- REQ-005: Respostas que não serializam nomes de votantes não carregam a relação dos gdevs votantes; contagens e percentuais permanecem corretos.
- REQ-006: Nenhuma migration ou alteração de esquema é necessária.
- REQ-007: A validação cobre as regras existentes de payload, ordenação, cursor, `since`, votos, opções, permissões, sugestões e auditoria, além das novas garantias de carregamento em lote.
- REQ-008: A linha de base é registrada antes da primeira alteração; extrações são feitas em etapas pequenas, com validação focada após cada etapa e repetição da validação completa ao final.
- REQ-009: O primeiro commit que altera código de produção é precedido por um commit verde que altera somente testes e caracteriza a semântica existente de `since` com `limit` menor que o número de polls alterados.

## Critérios de aceite

- Dada qualquer rota atual de enquetes, quando um gdev executa o fluxo equivalente antes e depois da refatoração, então status HTTP, formato e conteúdo JSON observável permanecem iguais.
- Dada uma lista paginada ou sincronização por `since`, quando a resposta é montada, então ordenação, cursor, snapshot e semântica atual da janela incremental permanecem iguais.
- Dado um gdev anônimo ou autenticado, quando consulta uma enquete, então contagens, percentuais, seleção, visibilidade de votantes e opções seguem as regras existentes.
- Dadas operações de criação, fechamento, voto, remoção/ocultação de opção e auditoria, quando executadas com as mesmas entradas, então persistência, autorização, transições e eventos permanecem iguais.
- Dada uma listagem com mais de uma enquete, quando as consultas são observadas, então o número de consultas não cresce com uma resolução individual por item; o cálculo dos resultados não repete a varredura de todos os votos para cada opção.
- Dada uma resposta que não expõe nomes de votantes, quando é montada, então os modelos de gdevs votantes não são hidratados e contagens/percentuais continuam corretos.
- Dado o baseline e o código final, quando os comandos completos são executados, então lint e suítes SQLite e MySQL passam sem remoção de cobertura; qualquer skip é identificado pelo motivo do ambiente.
- Dado o commit de caracterização inicial, quando os testes são executados sem mudanças de produção, então o novo caso `since` com `limit` pequeno passa e a suíte atual continua verde.
- Ao final, `PollService` está removido ou reduzido a uma responsabilidade delimitada, controllers continuam finos e o diff não contém mudança de rota, contrato HTTP, esquema ou migration.

## Linha de base registrada antes do código

Checkout `develop` no commit `bc4c60e`, PHP 8.3.30. O PHPUnit usou SQLite `:memory:`.

- `composer lint`: passou (Pint).
- `composer test`: 153 passaram, 1 skip, 925 assertions.
- `composer test:parallel`: 153 passaram, 1 skip, 925 assertions.
- `composer test:random`: 153 passaram, 1 skip, 925 assertions; seed `1793211452`.
- `php artisan test --env=mysql.testing`: 154 passaram, 928 assertions, no banco isolado `gaydevs_test`.

O teste ignorado nas execuções SQLite é o cenário de confirmações concorrentes, que exige row locks MySQL; ele passou na suíte MySQL. Essa linha de base é referência para a comparação pós-refatoração, não uma aprovação da spec ou do plano.

## Validação final após a refatoração

Executada no estado final da branch, sem mudanças de rota ou migration:

- `composer lint`: passou.
- `php artisan test tests/Feature/PollsTest.php`: 46 passaram, 264 assertions.
- `composer test`, `composer test:parallel` e `composer test:random`: cada execução teve 156 passaram, 1 skip, 936 assertions.
- Seed de `composer test:random`: `1793216986`.
- `php artisan test --env=mysql.testing`: 157 passaram, 939 assertions, usando `gaydevs_test`.
- O único skip SQLite continua sendo a confirmação concorrente que exige row locks MySQL; o caso passou no MySQL.

A comparação com a linha de base preserva a cobertura e adiciona três testes: o contrato `since` com `limit=1`, a ausência de resolução por poll na listagem e a não hidratação de votantes no payload anônimo. `PollService` foi removido; as responsabilidades agora estão em `PollReadService`, builders de payload e Actions específicas.

## Dependências e questões abertas

O helper SDD consultou a Issue #80 e confirmou zero blockers e zero dependências que bloqueiem esta demanda. O comportamento-alvo e seus limites estão descritos na Issue atualizada. As fronteiras concretas de classes e a sequência detalhada de extrações ficam para o plano técnico.

## Aprovação humana

Aprovada por gdev luvittor em 2026-10-28, com referência à mensagem explícita “aprovado” nesta conversa.
