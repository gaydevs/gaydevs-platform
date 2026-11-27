# Tasks — 00113

Issue: https://github.com/gaydevs/gaydevs-platform/issues/113 · Plano aprovado: [plan.md](plan.md) · [spec.md](spec.md)
Aprovação do plan: gdev solicitante, 2026-11-27, conversa ChatGPT (PLAN-01 a PLAN-20, quatro blocos e três ajustes); commit 0744923.
Fluxo: SDD normal, High Risk. Executar em ambiente isolado; manter tasks neste arquivo.

## Execução

### Fundação e dados (PLAN-01 a PLAN-05)

- [ ] T001 — Revalidar issue, dependências, branch e integração com develop; preparar ambiente local isolado, confirmar versões SQLite/MySQL e baseline de testes, sem dados reais.
- [ ] T002 — Criar migration, enum, model e factory de applicants com UUID v7, campos do plano, revision, índices e coluna gerada active_email UNIQUE; testar histórico e unicidade concorrente.
- [x] T003 — Criar models/migrations de applicant_consents e applicant_events com constraints, versionamento e idempotência; testar registro atômico de etapas e decisões.
- [x] T004 — Migrar otp_requests com email, purpose e applicant_id, user_id nullable, índices e constraints; preservar legado e testar backfill e integridade de otp_attempts.
- [x] T005 — Adicionar users.applicant_id nullable UNIQUE com FK; testar upgrade e proteção de downgrade quando houver dados novos.
- [x] T006 — Implementar transições de candidatura, normalização de email, locks por email e repositório/ações de domínio; testar corrida entre criação, retomada, submissão e aprovação.

### OTP, sessões e segurança (PLAN-06 a PLAN-10)

- [ ] T007 — Extrair primitivas compartilhadas de OTP por sujeito/purpose preservando login; testar geração, hash, expiração, supersessão e tentativas, inclusive user_id null.
- [ ] T008 — Implementar request/verify de candidatura, incluindo membro existente sem enumeração, recusada com novo registro somente após OTP e retomada draft/pending; verificar ausência de autenticação de membro.
- [ ] T009 — Implementar Turnstile server-side com hostname/action, configuração, fail closed e fakes de teste; exigir novo token em cada envio.
- [ ] T010 — Implementar limites de candidatura, cooldown, HMAC das chaves e reserva atômica; aplicar limites aprovados de OTP/SMTP compartilhado e reservar margem de login; testar concorrência, falhas e tentativas inválidas.
- [ ] T011 — Implementar sessão exclusiva de candidato, armazenamento server-side e cookie seguro independente de membro, 30 dias de inatividade/90 dias absolutos configuráveis, revogação na nova autenticação, logout e isolamento de propósitos; testar relógio, CSRF, revogação e regressão.
- [ ] T012 — Implementar middleware de identidade/status do candidato, configuração protegida de contato do scrum master, feature gate e no-store; revisar TrackVisitor, erros e logs para evitar exposição de dados.

### API, validações, administração (PLAN-11 a PLAN-15)

- [ ] T013 — Criar GET /applications/session, GET /applications/terms, PATCH /applications/steps/{step} e logout; validar autorização, whitelist, revision e etapas, com recuperação persistente.
- [ ] T014 — Implementar validações de nomes, email, WhatsApp E.164, origem livre, interesse em colaboração e confirmação GitHub; aceitar handle ou URL completa de redes e persistir URL canônica.
- [ ] T015 — Implementar verificador de perfis HTTPS com hosts e paths autorizados, DNS/IP pinning e bloqueios SSRF, timeout, cache e resultados valid/invalid/inconclusive; testar com doubles de DNS/HTTP, sem chamadas a perfis reais.
- [ ] T016 — Versionar regras, aviso de privacidade e consentimentos; validar aceites obrigatórios e versões no backend, preservar histórico. Preparar texto para validação do responsável antes do release.
- [ ] T017 — Implementar POST /applications/submit com validação integral, transição pending, timestamps, evento e intenção única de notificação em transação; testar idempotência e conflitos.
- [ ] T018 — Implementar outbox/registro durável e envio administrativo por scheduler existente, com link autenticado, reserva de cota, retry seguro e estados de entrega incluindo resultado ambíguo; testar falha SMTP, reprocessamento e não duplicação conhecida.
- [ ] T019 — Implementar middleware admin reutilizável e APIs de listagem paginada, detalhe e observações; proteger dados, ordenar por submitted_at/id, impedir edição cadastral.
- [ ] T020 — Implementar decisões de aprovação/recusa com transações, locks, responsável e eventos; criar exatamente um membro ativo com applicant_id na aprovação; testar conflitos e rejeição sem criação de user.

### Frontend, wizard e onboarding (PLAN-16 a PLAN-19)

- [ ] T021 — Integrar CTA e rotas /apply, /admin/applications, /admin/applications/:id e /onboarding ao frontend; preservar base URL, deep links, navegação, proteção CSRF e componentes existentes.
- [ ] T022 — Implementar wizard mobile-first com aviso de privacidade, apresentação/email, Turnstile, OTP, cooldown, recuperação de sessão e contato do scrum master somente após OTP.
- [ ] T023 — Implementar identificação, perfis com prefixos fixos, colagem de URL, handle e confirmação GitHub ausente; mostrar erros e validações sem bloquear verificações inconclusivas.
- [ ] T024 — Implementar origem com autocomplete local (qualquer palavra, sem caixa/acentos, seis sugestões aprovadas, texto livre obrigatório), interesse em colaboração e persistência das etapas.
- [ ] T025 — Implementar redes da comunidade, aceites independentes e não pré-marcados, submissão e tela pending com WhatsApp; progresso 0/20/45/60/75/85/95/100 conforme persistência, retorno e retomada; acessibilidade e ausência de dados sensíveis em localStorage.
- [ ] T026 — Implementar fila/detalhe administrativo com origem, dados, aceites, links de perfis/WhatsApp, notas, confirmação de aprovação/recusa e estados de erro/carregamento; menu condicionado ao papel.
- [ ] T027 — Implementar onboarding de membro admitido no primeiro login e revisita pelo menu; registrar visto em preferência, não bloquear plataforma nem forçar membros legados; apresentar orientações e iniciativas atuais, sem automatizar ingresso externo.

### Infraestrutura e documentação (PLAN-20)

- [ ] T028 — Documentar .env.example e requisitos de hospedagem: Turnstile, contato/aviso, TTLs, limites, scheduler/outbox, CSP, feature gate, migrations e recuperação; não editar .env real.
- [ ] T029 — Revisar escopo, segurança e privacidade: minimizar logs/avisos, avaliar política de retenção/direitos com responsável, revisar termos finais antes de ativar CTA; confirmar configuração necessária para release.

## Validação

- [ ] T030 — Executar testes backend Pest e lint/Pint, incluindo regressão de autenticação/polls, concorrência em MySQL isolado e upgrade de schema em MySQL e SQLite. Registrar comandos e evidências; não alegar execução de ambiente indisponível.
- [ ] T031 — Executar testes frontend Vitest/Testing Library, lint, typecheck, build e check:content; cobrir fluxos principais, regressões e casos de erro.
- [ ] T032 — QA manual mobile/desktop isolado, deep links e smoke Turnstile com test keys/e-mail fake; verificar privacidade, sessão e regras de acesso; confrontar todos os 14 REQs e 19 cenários de aceite da spec.
- [ ] T033 — Revisão de diff, migrations, contratos, riscos e evidências; atualizar checklist e documentação; publicar branch e abrir PR para develop com Refs #113 e Spec: 00113. Sincronizar Project conforme workflow; solicitar revisão de outro gdev. Não aprovar/merge/release automaticamente.

## Evidências de execução — 2026-11-27

- T001 (parcial): branch sincronizada com origin/develop (nenhum commit atrás); issue aberta e sem dependências bloqueantes. Ambiente isolado Survivor, PHP local 8.4.27, SQLite 3.46.1, dependências Composer do mesmo lockfile e .env.testing local com chave descartável. Baseline backend: 168 testes passaram, 2 ignorados, 1000 assertions. A primeira execução falhou por falta de APP_KEY, corrigida apenas no ambiente de testes. Docker sem permissão e driver PDO MySQL indisponível; confirmar MySQL e PHP 8.3 em ambiente isolado antes de concluir T001.
- T002 (parcial): migration applicants, enum, model e factory implementados. Coluna gerada active_email UNIQUE validada em SQLite, inclusive histórico e mudanças de status. Falta validar a corrida com conexões concorrentes em MySQL e compatibilidade com o host.
- T003: migrations/models de applicant_consents e applicant_events, chaves únicas por versão e event_key, FK restrict e rollback conjunto de alteração + evento testados em SQLite. Versionamento de textos e chamadas transacionais de domínio continuam nas tarefas T006/T016/T017/T020.
- Validação focada: ApplicantFoundationTest.php, 8 testes passaram (25 assertions); Pint passou nos 8 arquivos novos. Sem rotas públicas, alterações de autenticação ou deploy nesta etapa.

- T004: schema OTP estendido com purpose, email e applicant_id; user_id nullable. Triggers de INSERT/UPDATE preservam finalidade, identidade e snapshot; login limitado a purpose login em emissão, supersessão e verificação. Backfill conservador por timestamps, mantendo NULL quando o histórico não permite inferência segura. Upgrade com OTPs/attempts legados e FK preservados testado em SQLite. Rollback protegido. Validar sintaxe, versão e privilégio TRIGGER no MySQL isolado antes do release (T001/T028/T030); DDL MySQL não é transacional.
- T005: users.applicant_id nullable/UNIQUE/FK restrict, preservando restrições existentes em SQLite por ALTER TABLE ADD COLUMN nativo. Testados membro legado, vínculo único e proteção de downgrade.
- T006: serviço ApplicantLifecycle com lock por email normalizado (HMAC), transações, estados, auditoria e idempotência; criação/retomada, nova candidatura após recusa mediante prova, aprovação/recusa e membro ativo atômico. Teste com dois processos independentes e cache database em SQLite confirmou ausência de duplicidade na criação, confirmação, submissão e aprovação. T008 ainda integra consumo do OTP e transição na mesma transação; T017/T018 fornecem validação integral e intenção durável real; T019/T020 conectam autorização e APIs. Nenhum endpoint novo exposto nesta etapa.
- Regressão após T004–T006: PHP 8.4.27 + SQLite 3.46.1, 188 testes passaram, 2 ignorados, 1111 assertions; 12 testes novos em relação à etapa anterior. Pint --dirty --test passou em 16 arquivos. MySQL e PHP 8.3 permanecem pendentes (T001/T002/T030). Project apresentou Backlog em leitura apesar de tentativa anterior de atualização para In Progress; não considerar sincronizado.

## Limites

Sem dashboard, exclusão automática de candidaturas, edição cadastral administrativa ou automação de inclusão WhatsApp/gdevs-team. Aprovação de conteúdo final de privacidade, review e release continuam humanas. Não gerar issues automaticamente a partir destas tasks.
