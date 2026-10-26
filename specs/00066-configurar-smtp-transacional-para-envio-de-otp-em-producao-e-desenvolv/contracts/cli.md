# Contrato interno de comando

## `smtp:keepalive`

Comando interno executado pelo scheduler diário.

- Sem argumentos obrigatórios.
- Se o mailer efetivo não for SMTP, termina sem enviar mensagem.
- Se não houver `last_accepted_at` para o mailer `smtp`, termina sem enviar
  mensagem.
- Se o último envio SMTP aceito tiver menos de 80 dias, termina sem enviar.
- Se o prazo tiver vencido, envia uma mensagem técnica para
  `MAIL_FROM_ADDRESS` por `EmailSender`.
- Sucesso atualiza `smtp_transport_states.last_accepted_at`.
- Uma execução bem-sucedida torna a próxima execução idempotente enquanto o
  novo timestamp estiver dentro do prazo.
- Falha retorna código diferente de zero para o scheduler e registra somente a
  classe da exceção no log operacional.
- Não cria OTP, sessão, usuário ou chamada HTTP.

### Validação local

```powershell
php artisan smtp:keepalive
php artisan schedule:list
```

O comando não deve ser usado para forçar um envio durante o teste manual de
entrega; o OTP controlado é o teste de SMTP. A suíte automatizada usa
`Mail::fake()` e não abre conexão externa.
