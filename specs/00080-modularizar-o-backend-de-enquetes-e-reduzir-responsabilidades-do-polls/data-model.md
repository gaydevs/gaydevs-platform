# Modelo de dados preservado — #00080

Esta refatoração não altera tabelas, chaves, colunas, casts ou migrations. O resumo registra os vínculos que as consultas e Actions precisam manter.

| Entidade | Relações relevantes | Invariantes preservadas |
| --- | --- | --- |
| `Poll` | criador, responsável por fechar, opções e votos | Slug estável; `allow_multiple` e `allow_new_options` governam operações; enquete fechada rejeita votos e mudanças de opção. |
| `PollOption` | enquete, criador, responsável por ocultar e votos | Opções ocultas não participam dos resultados; regras de autoria e mínimo visível continuam aplicadas. |
| `PollVote` | enquete, opção e gdev opcional | Votos ativos e cancelados são mantidos como histórico; `user_id` nulo representa voto legado anônimo; ordem usa criação/ID quando aplicável. |
| `User` | criador/votante e preferências | Só contas ativas recebem contexto autenticado nos payloads; regras de admin e autoria permanecem iguais. |
| `UserPreference` | pertence ao gdev | Preferências de snooze e polls dispensados continuam filtrando sugestões. |

Não há entidade nova nem conversão de votos. A serialização e as consultas usam os modelos existentes.
