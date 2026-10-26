# Validação rápida

## Pré-requisitos

- PHP/Composer do backend disponíveis.
- `.env` local configurado sem versionar credenciais.
- Remetente/domínio autenticado, chave SMTP ativa e plataforma transacional da
  conta Brevo habilitada para o teste SMTP.

## Desenvolvimento

1. Inicie com `MAIL_MAILER=log` e confirme o fluxo local pelo log.
2. Altere temporariamente o `.env` externo para `MAIL_MAILER=smtp`,
   `MAIL_SCHEME=tls`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=587` e as
   credenciais/remetente controlados.
3. Execute `php artisan config:clear`, solicite um único OTP pelo frontend e
   confirme recebimento, remetente e evento no painel transacional.
4. Restaure `MAIL_MAILER=log` e execute `php artisan config:clear` novamente.

## Produção

1. Confirme no painel a plataforma transacional habilitada, a chave SMTP ativa
   e o remetente autenticado.
2. Confirme os valores SMTP no `.env` externo, sem exibi-los.
3. Faça um único pedido de OTP para um destinatário controlado.
4. Confirme recebimento, remetente e evento no painel transacional da Brevo.
5. Registre somente ambiente, data e resultado fora do Git, sem destinatário
   completo, OTP ou credenciais.

## Keepalive

O scheduler executa `smtp:keepalive` diariamente às 00:00 no fuso
`America/Sao_Paulo`, com `withoutOverlapping`. O comando:

- não envia se o mailer efetivo não for `smtp`;
- não envia enquanto não houver um `last_accepted_at` persistido ou enquanto o
  último envio tiver menos de 80 dias;
- envia uma mensagem técnica para `MAIL_FROM_ADDRESS` quando o prazo vencer;
- atualiza o estado somente após o envio SMTP terminar sem exceção;
- retorna erro e registra diagnóstico sanitizado quando o envio falha.

Não é necessária uma verificação periódica manual no painel da Brevo para esta
Issue: a atividade é registrada pelo backend e o keepalive é automático. O
teste manual de entrega continua sendo obrigatório uma vez em dev e uma vez em
produção.

## Suíte automatizada

```powershell
php artisan test
php artisan schedule:list
composer lint
```

Todos os testes devem usar `Mail::fake()` ou outro transporte não externo.
