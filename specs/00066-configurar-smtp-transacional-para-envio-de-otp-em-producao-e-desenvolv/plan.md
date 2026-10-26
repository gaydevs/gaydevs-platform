# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/66 · Spec: [spec.md](spec.md)
Aprovação da spec: `luvittor`, 2026-10-26, aprovação explícita nesta conversa.

## Abordagem

1. Preservar o transporte SMTP nativo do Laravel e completar a documentação e
   os placeholders de ambiente para Brevo. O `.env` real de desenvolvimento e
   o arquivo externo de produção não serão versionados.
2. Expandir a configuração de limites globais de e-mail para dois contadores:
   150 envios por hora e 250 envios em 86.400 segundos. Os dois devem ser
   verificados e reservados antes de persistir o OTP. A reserva será protegida
   por lock do cache compartilhado para evitar que concorrência deixe um
   contador reservado sem o outro.
3. Manter o serviço `EmailSender` como ponto único de envio. Um envio SMTP
   aceito atualiza o estado persistente do último envio associado ao mailer
   Laravel `smtp`; falhas não atualizam esse estado e registram apenas
   diagnóstico sanitizado. O código não usará `brevo` como identificador.
4. Criar um estado persistente mínimo para o transporte SMTP e um comando
   `smtp:keepalive`, agendado diariamente e protegido contra sobreposição. Após
   80 dias sem envio SMTP aceito, o comando envia uma mensagem técnica para
   `MAIL_FROM_ADDRESS`. O comando não cria OTP e fica inerte quando o mailer
   não é SMTP.
5. Adicionar testes isolados para limites, concorrência, persistência do
   estado, keepalive e ausência de envio externo. Atualizar o README e o
   requisito de hospedagem com o teste manual em dev/prod e o rollback para
   `MAIL_MAILER=log`.

Alternativas rejeitadas: API da Brevo ou webhooks nesta Issue; depender da fila
de retry do provedor; usar cache como única fonte do último envio; criar um
destinatário de keepalive separado; ou implementar sincronização automática de
blocklist/bounces com membros.

## Impactos e dependências

- Backend: configuração, serviço de envio, limiter, comando, agendamento e
  testes.
- Dados: uma migration não destrutiva para persistir o estado do transporte;
  nenhum dado de OTP, conteúdo ou credencial será armazenado nessa estrutura.
- Infraestrutura: o scheduler já existente deve continuar executando a cada
  minuto; o deploy mantém o `.env` externo e o `config:cache`.
- Segurança: logs não registram segredo SMTP, OTP, corpo da mensagem ou
  endereço completo; a chave SMTP permanece externa e deve ser específica da
  integração. O host e as credenciais continuam somente no ambiente.
- Operação: a ativação transacional da conta Brevo será comprovada pelo teste
  controlado em produção. Não há bloqueadores `blocked by`; a Issue #66
  bloqueia a Issue #30.

## Validação

- Testes Pest/PHPUnit com `Mail::fake()` para os limites horário e diário,
  bloqueio antes da persistência, rollback de reserva parcial e concorrência.
- Testes do `smtp:keepalive` para estado ausente, estado dentro do prazo,
  estado vencido, mailer `log`, sucesso e falha SMTP.
- Teste de configuração garantindo os defaults e os dois limites aprovados.
- `schedule:list` confirmando o agendamento diário e
  `git diff --check`.
- Suíte completa do backend em SQLite e MySQL, além de lint.
- Teste manual controlado em desenvolvimento com SMTP e em produção; após o
  teste local, restaurar `MAIL_MAILER=log` e limpar o cache de configuração.

## Constitution check

- Uma única spec para a mudança de backend, configuração, operação e testes.
- Issue existente, branch `techdebt/00066-...` e pasta única
  `specs/00066-...` preservam rastreabilidade.
- Issue consultada via `gh`: aberta, Tech Debt, prioridade High, sem
  bloqueadores e em `Backlog` antes do início.
- Não há fast-track: a mudança envolve SMTP de produção, limites, segredo,
  persistência e agendamento.
- A spec foi aprovada humanamente; este plan agora aguarda aprovação humana
  antes de tasks ou implementação.
- Não há migration destrutiva, alteração de contrato HTTP, geração/validação
  de OTP ou failover de provedor.

## Aprovação humana

Pendente. Registrar gdev, data e referência antes de criar `tasks.md` ou
iniciar a implementação.
