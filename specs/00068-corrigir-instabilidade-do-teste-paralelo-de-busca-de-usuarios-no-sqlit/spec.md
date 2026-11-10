# 00068 — Corrigir instabilidade do teste paralelo de busca de usuários no SQLite

Issue: https://github.com/gaydevs/gaydevs-platform/issues/68
Fast-track Low Risk aprovado pelo gdev em 2026-11-10, restrito a alterações nos testes.

## Objetivo

Remover a fonte de não determinismo nos fixtures de `UserSearchTest.php`, que pode provocar um resultado extra na busca `/users?q=Ro` e falha intermitente da suíte SQLite com ordem aleatória.

## Escopo

- Substituir e-mails Faker aleatórios por endereços de teste explícitos nos usuários com nome fixo utilizados em `UserSearchTest.php`.
- Preservar o endpoint, as regras de busca, as máscaras, os casos de borda e o comportamento do backend.
- Não alterar isolamento transacional, configuração de banco nem workflow CI sem uma falha reproduzível dessa camada.

## Critérios de aceite

- Os fixtures têm nomes/e-mails determinísticos, sem colisões inesperadas com os termos consultados.
- Asserções existentes de prefixo, palavras posteriores, ranking, máscara, limite e rate limiting continuam passando.
- Execuções repetidas da suíte SQLite paralela com ordem aleatória passam; backend SQLite, MySQL, lint e audit do CI permanecem verdes.
- Se um novo defeito de isolamento se manifestar, ele deve ser investigado separadamente, sem atribuir garantia absoluta a um teste probabilístico.

## Aprovação

Seleção explícita da #68 em 2026-11-10 após proposta de fast-track Low para correção restrita a testes.
