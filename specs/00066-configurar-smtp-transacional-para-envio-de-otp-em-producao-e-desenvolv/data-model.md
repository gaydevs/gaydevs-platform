# Modelo de dados

## `smtp_transport_states`

Estado persistente mínimo para controlar a atividade da chave usada pela
integração SMTP.

| Campo | Regra |
| --- | --- |
| `id` | Identificador interno da linha única do transporte |
| `mailer` | Nome lógico do mailer Laravel, inicialmente `smtp` |
| `last_accepted_at` | Timestamp nullable do último envio aceito pelo relay |
| `created_at` / `updated_at` | Timestamps padrão |

Regras:

- Deve existir no máximo uma linha por mailer configurado.
- O valor `smtp` vem da configuração do mailer Laravel (`MAIL_MAILER`), não do
  host SMTP, do remetente ou de uma consulta à Brevo.
- `last_accepted_at` só muda depois de `Mail::send()` terminar sem exceção e
  somente quando o mailer efetivo for SMTP.
- O keepalive consulta esse campo; não armazena OTP, corpo, credencial,
  destinatário ou conteúdo de mensagem.
- A migration é aditiva e não remove nem altera tabelas existentes.
