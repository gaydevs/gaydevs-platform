# Pesquisa e decisões

## Brevo Free

Decisão: limitar a aplicação a 250 envios em 86.400 segundos e a 150 envios
por hora.

Racional: a Brevo documenta 300 envios por dia e uma fila de retry limitada,
mas não documenta no material consultado o horário/fuso exato do reset nem uma
janela móvel. A janela própria de 24 horas é conservadora e não depende dessa
semântica.

Fonte registrada no repositório: `.verification/brevo-free-plan.md`. Fontes
oficiais consultadas: [limites do plano Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
e [gerenciamento de chaves SMTP](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys).

## Transporte

Decisão: usar o transporte SMTP já suportado pelo Laravel, configurado pelo
ambiente, em vez da API da Brevo.

Racional: atende ao escopo da Issue, não exige dependência nova e preserva o
contrato atual do `EmailSender`.

## Keepalive

Decisão: enviar uma mensagem técnica para `MAIL_FROM_ADDRESS` após 80 dias sem
envio SMTP aceito, por comando diário.

Racional: a Brevo pode desativar uma chave sem expiração após 90 dias de
inatividade. O estado precisa ser persistente para sobreviver a deploys e
limpeza de cache. O timestamp representa aceitação pelo relay, não entrega na
caixa do destinatário.

## Eventos de entrega

Decisão: identificar o estado pelo mailer lógico `smtp`, sem gravar o nome
Brevo no código.

Racional: o provedor é uma configuração externa do mailer SMTP. O nome do
host pode mudar e não deve ser usado como identidade persistente.

Decisão adicional: não criar webhook nem sincronização de blocklist nesta
Issue.

Racional: os testes manuais em dev/prod validam a entrega inicial; o escopo
atual exige diagnóstico local e não uma integração de eventos. Webhooks podem
ser uma Issue futura se houver necessidade de automatizar bounces e bloqueios.
