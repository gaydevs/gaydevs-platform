# 00066 — Configurar SMTP transacional para envio de OTP em produção e desenvolvimento

Issue: https://github.com/gaydevs/gaydevs-platform/issues/66
Estado: aprovado — aprovação humana registrada.

## Problema e objetivo

O envio de OTP depende atualmente do transporte de e-mail do DreamHost, com
atrasos e baixa previsibilidade. A mudança deve usar a Brevo como transporte
SMTP transacional, sem expor credenciais, e manter um caminho local controlado
que permita alternar entre registro em log e entrega real.

O plano Free da Brevo limita a conta a 300 envios por dia. A aplicação deve
reservar margem própria e evitar depender da fila de retry do provedor.

## Escopo e comportamento

### Configuração

- Produção usa SMTP da Brevo por variáveis de ambiente, com TLS e porta 587.
- Desenvolvimento pode alternar entre `MAIL_MAILER=log` e `MAIL_MAILER=smtp`.
- Credenciais, chave SMTP e remetente real permanecem somente nos ambientes
  externos ou ignorados; não entram em código, Issue, spec ou logs.
- O remetente usa o endereço configurado em `MAIL_FROM_ADDRESS`, já autenticado
  na Brevo.

### Limites de envio

- O envio de OTP fica sujeito simultaneamente a 150 mensagens por hora e 250
  mensagens em uma janela própria de 24 horas.
- A janela de 24 horas é um limite conservador da aplicação e não depende do
  horário de reset adotado pela Brevo.
- A reserva da cota ocorre antes da emissão/persistência do OTP e do envio.
- Os limites existentes por usuário e IP permanecem como configuração
  operacional separada e não são alterados por esta Issue.
- O sistema não depende da fila de retry da Brevo para aceitar novos OTPs.

### Keepalive da chave SMTP

- Uma tarefa agendada verifica diariamente a data do último envio SMTP aceito
  pela aplicação.
- Após 80 dias sem envio SMTP aceito, envia um e-mail técnico para o próprio
  `MAIL_FROM_ADDRESS`, sem gerar ou validar OTP.
- O keepalive usa o mesmo transporte e a mesma reserva global de e-mail.
- A data é atualizada somente quando o relay aceita o envio sem exceção.
- O keepalive fica desabilitado por padrão em ambientes que usam apenas o
  mailer `log`.

### Diagnóstico e validação

- Falhas SMTP, bloqueios dos dois limites e execuções do keepalive são
  registradas no log operacional sem OTP, credenciais ou conteúdo sensível.
- A validação manual cobre uma entrega controlada em desenvolvimento e outra
  em produção. Em desenvolvimento, o ambiente retorna a `MAIL_MAILER=log`
  após o teste.
- A suíte automatizada continua usando `Mail::fake()` e não realiza envio
  externo.

Fora do escopo: integração com webhooks da Brevo, sincronização automática de
_blocklist_ ou bounces com membros, failover entre provedores, uso da API da
Brevo, alterações na geração/validação do OTP e alteração dos limites por
usuário ou IP.

## Requisitos verificáveis

- REQ-001: O backend deve selecionar o transporte SMTP quando
  `MAIL_MAILER=smtp` e usar os parâmetros SMTP fornecidos pelo ambiente.
- REQ-002: O desenvolvimento deve conseguir alternar entre `log` e `smtp`
  sem alteração de código.
- REQ-003: Nenhum segredo SMTP deve existir nos arquivos versionados, Issues,
  specs, testes ou logs operacionais.
- REQ-004: Cada solicitação de OTP deve ser bloqueada quando qualquer um dos
  limites globais de e-mail estiver esgotado.
- REQ-005: Um OTP bloqueado por limite global não deve ser persistido nem
  enviado.
- REQ-006: O keepalive deve enviar no máximo uma mensagem por ciclo de 80 dias
  sem envio SMTP aceito e não deve criar um OTP.
- REQ-007: Uma falha SMTP não deve expor credenciais, OTP ou conteúdo sensível
  no diagnóstico.
- REQ-008: Testes automatizados devem permanecer sem conexão SMTP externa,
  usando `Mail::fake()`.
- REQ-009: O procedimento de teste deve comprovar entrega controlada em
  desenvolvimento e produção, com retorno do desenvolvimento para `log`.

## Critérios de aceite

- Dado um ambiente com `MAIL_MAILER=smtp`, quando o backend solicita um OTP,
  então o e-mail é enviado pelo SMTP da Brevo com TLS e remetente configurado.
- Dado um ambiente local, quando `MAIL_MAILER` alterna entre `log` e `smtp`,
  então o fluxo usa respectivamente o log local ou a entrega SMTP, sem mudança
  de código.
- Dado que o contador horário ou diário esteja esgotado, quando um OTP for
  solicitado, então a operação é bloqueada antes da persistência e do envio.
- Dado que tenham transcorrido 80 dias desde o último envio SMTP aceito,
  quando a tarefa agendada executar, então um e-mail técnico é enviado para
  `MAIL_FROM_ADDRESS` e o envio fica registrado.
- Dado que o ambiente esteja configurado para `MAIL_MAILER=log`, quando a
  tarefa de keepalive executar, então nenhum e-mail externo é enviado.
- Dado um teste automatizado do fluxo de OTP, quando a suíte executar, então
  `Mail::fake()` impede qualquer envio externo.
- Dado um teste manual controlado em desenvolvimento e outro em produção,
  quando o OTP for solicitado, então ambos são recebidos e o ambiente de
  desenvolvimento retorna ao modo `log` após a validação.

## Dependências e questões abertas

- A Issue #66 está sem `blocked by` e bloqueia a Issue #30.
- A conta Brevo, a chave SMTP e o domínio/remetente autenticado são
  pré-requisitos externos; a ativação transacional será confirmada pelo teste
  SMTP controlado em produção.
- O reset diário da Brevo não tem horário/fuso documentado de forma suficiente
  para ser usado como relógio da aplicação; por isso o limite de 250 mensagens
  usa uma janela própria de 86.400 segundos.

## Aprovação humana

Aprovada por `luvittor` em 2026-10-26, por aprovação explícita nesta conversa.
