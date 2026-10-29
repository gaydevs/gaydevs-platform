# Contrato HTTP de enquetes preservado — #00080

Este inventário descreve os endpoints atuais para proteger a refatoração. Não propõe rota nem campo novo.

| Método e rota | Acesso atual | Resposta observável a preservar |
| --- | --- | --- |
| `GET /polls` | Sanctum e gdev ativo | `polls`, `next_cursor`, `has_more`, `synced_at`; página por `limit` (padrão 3, máximo 20) e cursor. Com `since`, retorna todos os polls alterados na janela e não aplica `limit`. |
| `GET /polls/{identifier}` | Público | Payload do poll, contagens e percentuais. Viewer ativo também recebe seleção, votantes e votos anônimos conforme o payload atual. |
| `GET /polls/{identifier}/audit` | Sanctum e gdev ativo | Poll e eventos de criação, opção, voto, cancelamento e fechamento, na ordem cronológica atual. |
| `POST /polls` | Sanctum, gdev ativo e admin de polls | `201`, envelope `poll`; slug e opções criados conforme validação existente. |
| `POST /polls/{identifier}/close` | Sanctum, gdev ativo e admin de polls | `200`, envelope `poll`; fechamento idempotente e autoria preservados. |
| `POST /polls/{identifier}/responses` | Sanctum e gdev ativo | `200`, poll atualizado e sugestões; regras de voto, cancelamento e transação preservadas. |
| `POST /polls/{identifier}/options` | Sanctum e gdev ativo | `201`, opção criada; enquete precisa permitir novas opções. |
| `DELETE /polls/{identifier}/options/{option}` | Sanctum e gdev ativo | `204`; autoria, votos de terceiros e mínimo de opções continuam protegidos. |
| `POST /polls/{identifier}/options/{option}/hide` | Sanctum, gdev ativo e admin de polls | `200`, envelope `poll`; opção e votos tratados conforme as regras atuais. |

Rotas continuam com prefixo API atual e middleware atual. Status de validação/autorização/not-found e os envelopes JSON não mudam. Nenhuma alteração em `routes/api.php` é esperada.
