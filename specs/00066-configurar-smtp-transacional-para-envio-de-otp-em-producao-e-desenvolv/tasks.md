# Tasks: SMTP transacional da Brevo para OTP

Issue: https://github.com/gaydevs/gaydevs-platform/issues/66 · Plano aprovado:
[plan.md](plan.md)

Aprovação do plan: `luvittor`, 2026-10-26, aprovação explícita nesta conversa.

## Pré-requisitos

- Branch `techdebt/00066-configurar-smtp-transacional-para-envio-de-otp-em-producao-e-desenvolv` ativa.
- Spec e plan aprovados; não criar Issues automaticamente.
- Credenciais SMTP permanecem somente nos `.env` ignorados/externos.

## Phase 1: Preparação

- [x] T001 Confirmar em `backend/.gitignore`, `backend/.env.example` e no índice Git que nenhum `.env` com credencial SMTP é versionado; registrar a configuração real somente fora do repositório.
- [x] T002 [P] Atualizar `backend/.env.example` e `backend/config/rate_limits.php` para documentar 150 envios globais por 3600 segundos e adicionar 250 envios globais por 86400 segundos, preservando `MAIL_MAILER=log` como padrão local.

## Phase 2: Fundação compartilhada

- [x] T003 Criar a migration aditiva `backend/database/migrations/2026_10_26_000000_create_smtp_transport_states_table.php` com uma linha por mailer lógico, campo `mailer` inicialmente `smtp`, `last_accepted_at` nullable e timestamps; não armazenar destinatário, OTP, conteúdo ou credencial.
- [x] T004 Criar o model/repositório de estado em `backend/app/Models/SmtpTransportState.php` e `backend/app/Services/SmtpTransportStateStore.php`, usando `config('mail.default')`/mailer efetivo como origem do identificador e upsert idempotente.
- [x] T005 Refatorar `backend/app/Services/EmailRateLimiter.php` para verificar e reservar atomicamente os contadores horário e de 24 horas com lock do cache compartilhado, fazendo rollback de reserva parcial e mantendo logs sem dados sensíveis.
- [x] T006 Atualizar `backend/app/Services/EmailSender.php` para registrar `last_accepted_at` somente após envio SMTP sem exceção, sem registrar envios realizados pelo mailer `log`; preservar `send`, `reserve` e `sendReserved` para os chamadores existentes.
- [x] T007 [P] Adicionar testes de migration, estado persistente e diagnóstico sanitizado em `backend/tests/Feature/SmtpTransportStateTest.php` e `backend/tests/Feature/EmailSenderTest.php`.

## Phase 3: US1 — SMTP configurável para entrega de OTP

**Objetivo:** usar SMTP quando configurado e manter o modo `log` no desenvolvimento.

**Teste independente:** alternar `MAIL_MAILER` entre `log` e `smtp` sem mudar código; a suíte automatizada não abre conexão externa.

- [x] T008 [P] Cobrir a configuração efetiva do mailer e os defaults aprovados em `backend/tests/Feature/ApplicationConfigurationTest.php`, incluindo `MAIL_SCHEME=tls`, porta 587 e remetente por `MAIL_FROM_ADDRESS` sem valores reais.
- [x] T009 Atualizar `backend/config/mail.php` apenas onde necessário para validar o transporte SMTP nativo, mantendo `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` e `MAIL_FROM_NAME` vindos do ambiente; não adicionar identificação `brevo` ao código. A configuração existente já atendia ao contrato; foram adicionados placeholders seguros ao `backend/.env.example`.
- [x] T010 Atualizar `backend/README.md` com o procedimento de alternância local, teste controlado de OTP, retorno para `MAIL_MAILER=log` e limpeza de cache sem expor credenciais.

## Phase 4: US2 — Limites globais compatíveis com a cota

**Objetivo:** impedir que o projeto ultrapasse os limites internos de 150/h e 250/24h.

**Teste independente:** esgotar cada contador isoladamente e comprovar bloqueio antes de persistir ou enviar o OTP.

- [x] T011 [P] Estender `backend/tests/Feature/EmailSenderTest.php` e `backend/tests/Feature/OtpRequestTest.php` para cobrir 150/h, 250/24h, expiração de cada janela, concorrência, reserva parcial e ausência de persistência quando qualquer contador estiver esgotado.
- [x] T012 Ajustar `backend/app/Actions/RequestLoginOtp.php` e `backend/app/Services/EmailSender.php` para usar a reserva conjunta dos dois contadores sem alterar geração, hash, expiração ou validação do OTP.
- [x] T013 Atualizar `backend/tests/Feature/ApplicationConfigurationTest.php` e `backend/README.md` para refletir os dois limites e deixar explícito que a aplicação não depende da fila de retry da Brevo.

## Phase 5: US3 — Keepalive da chave SMTP

**Objetivo:** manter a chave SMTP ativa após 80 dias sem envio SMTP aceito.

**Teste independente:** avançar o relógio do estado persistido e executar o comando; o keepalive envia apenas em mailer SMTP e usa `MAIL_FROM_ADDRESS` como destinatário.

- [x] T014 [P] Criar testes em `backend/tests/Feature/SmtpKeepaliveTest.php` para estado ausente, prazo não vencido, prazo vencido, `MAIL_MAILER=log`, sucesso, falha, atualização do timestamp e ausência de criação de OTP.
- [x] T015 Criar `backend/app/Mail/SmtpKeepaliveMail.php` e `backend/app/Console/Commands/SmtpKeepalive.php`, com mensagem técnica não sensível, execução diária idempotente e falha registrada para o scheduler.
- [x] T016 Registrar `smtp:keepalive` em `backend/bootstrap/app.php` com execução diária e `withoutOverlapping`, usando o estado do mailer `smtp` e interrompendo sem envio quando o mailer efetivo não for SMTP.
- [x] T017 Atualizar `backend/tests/Feature/ApplicationConfigurationTest.php` para confirmar a presença do comando no `schedule:list` e o comportamento sem envio externo no ambiente `log`.

## Phase 6: Documentação e validação final

- [x] T018 Atualizar `docs/backend-hosting-requirements.md` e `.verification/brevo-free-plan.md` com SMTP/TLS, limites 150/h e 250/24h, keepalive de 80 dias, ativação transacional e teste manual dev/prod; não inserir credenciais ou destinatários reais.
- [x] T019 [P] Atualizar `specs/00066-configurar-smtp-transacional-para-envio-de-otp-em-producao-e-desenvolv/quickstart.md` e `specs/00066-configurar-smtp-transacional-para-envio-de-otp-em-producao-e-desenvolv/contracts/cli.md` se o contrato executável do comando mudar durante a implementação.
- [x] T020 Executar `composer lint`, `php artisan schedule:list`, `git diff --check` e a suíte completa do backend em SQLite e MySQL isolado; confirmar que todos os testes usam `Mail::fake()` ou transporte não externo.
- [x] T021 Executar o teste manual controlado em desenvolvimento com SMTP da Brevo; o e-mail foi recebido com sucesso, o ambiente foi restaurado para `MAIL_MAILER=log` e o cache de configuração foi limpo. O teste de produção fica pendente para após o deploy e não é registrado neste repositório.

## Dependências e ordem

- T001–T002 precedem a fundação.
- T003–T006 precedem as três histórias; T007 pode acompanhar T003–T006 quando as interfaces estiverem definidas.
- US1 e US2 compartilham `EmailSender`; concluir T005–T006 antes de T008–T013.
- US3 depende de T004 e T006; T014 pode ser escrito em paralelo após o contrato do estado, mas T015–T017 dependem dele.
- T018–T021 são finais; o teste manual ocorre somente após a suíte automatizada e a revisão do diff.

## Oportunidades de paralelismo

- T002 e T003 podem ocorrer em paralelo.
- T007, T008 e T011 podem ocorrer em paralelo depois da definição das interfaces compartilhadas.
- T014 pode ocorrer em paralelo com T010 e T011 após T004.
- T018 e T019 podem ocorrer em paralelo após as decisões finais do comando.

## Estratégia de entrega

1. Implementar a fundação e os limites sem alterar o contrato de OTP.
2. Adicionar e testar o keepalive.
3. Atualizar documentação e executar validação automatizada completa.
4. Fazer os dois testes manuais controlados e registrar as evidências externas.

Tasks permanecem neste arquivo; não converter tasks em Issues.
