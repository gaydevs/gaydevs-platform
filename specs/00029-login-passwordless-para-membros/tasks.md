# Tasks: Login passwordless para membros

**Input**: [spec.md](./spec.md) e [plan.md](./plan.md)

**Pré-requisitos**: spec e plan aprovados; Issue #29 sem blockers.

**Regra de execução**: concluir e validar cada fase antes da próxima. O agente
não adiciona arquivos ao stage nem cria commit sem pedido explícito do gdev.
Até o encerramento desta spec, cada checkpoint de testes do backend deve executar
a suíte completa tanto em SQLite quanto no MySQL local 8.4.11, configurado no
arquivo não versionado `backend/.env.mysql`. Execuções paralela e aleatória são
complementares e não substituem essas duas execuções.

## Phase 1: Ambiente e esqueleto

- [x] T001 Confirmar PHP 8.3.30 em `C:\PHP\current`, extensões exigidas e
  Composer antes de inicializar o backend; não versionar dados de
  `.verification/dreamhost-server.md`.
- [x] T002 Criar `backend/composer.json` com Laravel 13, Sanctum, Pint, Pest e
  `config.platform.php` 8.3.30.
- [x] T003 Criar `backend/README.md` com instalação local, `php artisan serve`,
  SQLite, `MAIL_MAILER=log` e limites do ambiente DreamHost.
- [x] T004 [P] Criar `.vscode/launch.json` e `.vscode/extensions.json` para
  Xdebug, liberando somente esses arquivos na configuração de Git.
- [x] T005 Criar o esqueleto Laravel em `backend/`, com `.env.example` sem
  segredos, `routes/api.php`, `bootstrap/app.php` sem prefixo adicional `api`
  e `GET /ping`.
- [x] T006 Ajustar `backend/public/index.php` para o rewrite sem `/public/` e
  testar a resolução da base `/gaydevs/api/`.
- [x] T007 Configurar `frontend/vite.config.ts` com proxy versionado de
  `/gaydevs/api` para `http://localhost:8000`, sem criar `.env` no frontend.
- [x] T008 Validar o build do frontend, os comandos Laravel e a conexão pelo
  proxy com uma chamada temporária do frontend a `GET /ping`; confirmar
  `pong`, remover a UI diagnóstica e parar para a validação do gdev da Fase 1.

## Phase 2: Fundação de dados, segurança e CI

- [x] T009 Criar migrations portáveis SQLite/MySQL para membros, `visitors`,
  `visits`, `visitor_observations`, `ip_addresses`,
  `ip_geolocations`, OTP, sessões web efêmeras, sessões auditáveis e PATs;
  atribuir o contexto autenticado à observação exata.
- [x] T010 [P] Criar models Eloquent com UUID v7 em IDs públicos, `BIGINT` em
  IDs internos, relacionamentos e factories em `backend/app/Models` e
  `backend/database/factories`.
- [x] T011 Criar services reutilizáveis para mascaramento de e-mail,
  identificação por cookie pseudônimo, observações append-only e consulta
  GeoIP local versionada com cache/metadados da base; UUID v7 público é gerado
  pelos models.
- [x] T012 Criar Form Requests para busca de membro, pedido de OTP e validação
  de OTP em `backend/app/Http/Requests`.
- [x] T013 Configurar middleware de observação, tratamento genérico de erro de
  autenticação e fundação para atribuir cada chamada à sessão auditável ou PAT.
- [x] T014 Configurar o agendamento que, após 90 dias, trunca IPs para IPv4
  `/24` e IPv6 `/48`, preservando os derivados de GeoIP; registrar início,
  sucesso, falha e salto de toda tarefa num log diário dedicado; preparar
  atualização GeoIP diária, desabilitada até provisionamento do ambiente.
- [x] T015 Configurar scripts `composer lint` e testes Pest/PHPUnit, incluindo
  execução paralela e aleatória da suíte SQLite.
- [x] T016 Concluir `backend-lint.yml`, `backend-audit.yml`,
  `backend-test.yml`, `backend-deploy.yml` e a action de cache Composer;
  preparar a matriz SQLite/MySQL 8.4 para a validação final.
- [x] T017 Executar migrations e testes de fundação em SQLite e MySQL 8.4;
  parar para a validação do gdev da Fase 2.
  - [x] SQLite local: migrations e 36 testes/125 asserções nas execuções normal,
    paralela (4 processos) e aleatória.
  - [x] MySQL local 8.4.11: migrations e 36 testes/125 asserções na execução
    normal.
  - [x] Revisão manual e aprovação do gdev em 2026-10-19.

**Fase 2 aprovada pelo gdev em 2026-10-19.** A fundação foi validada em SQLite
e MySQL 8.4.11; a matriz completa será repetida na validação final, quando todas
as migrations e histórias estiverem prontas.

## Phase 3: Busca e pedido de OTP — MVP

**Objetivo**: um membro localiza seu registro sem expor o diretório e recebe um
OTP no e-mail cadastrado, sem criar sessão.

- [x] T018 [P] [US1] Escrever testes de busca sem termo, por prefixo de qualquer
  parte do nome ou do e-mail, máscara contextual, limite de cinco itens e
  e-mail nunca exposto integralmente em `backend/tests/Feature`.
- [x] T019 [P] [US1] Escrever testes de pedido de OTP, `Mail::fake()`, assunto
  com código, corpo copiável, expiração, ausência de sessão e dois pedidos
  concorrentes para o mesmo user produzindo somente um OTP pendente.
- [x] T020 [US1] Implementar `GET /users?q=` com limite de taxa, mínimo de um
  caractere, máximo de cinco resultados e busca pelo início do e-mail ou de
  qualquer parte do nome, com máscara contextual ao prefixo digitado.
- [x] T021 [US1] Implementar o service para a prova OTP sobre as migrations e
  models já preparados: seis dígitos inéditos por membro, hash, expiração de
  dez minutos, uso único e cinco falhas permitidas; serializar por user em
  transação e marcar o pedido pendente anterior com `superseded_at` e
  `superseded_by_id`.
- [x] T022 [US1] Implementar `POST /auth/otp`, limites de cinco pedidos/hora
  por membro e vinte/hora por IP, persistindo visitante e resultado do pedido.
- [x] T023 [US1] Criar Mailable do OTP usando Mail do Laravel, remetente de
  `MAIL_FROM_ADDRESS`, código no assunto e em linha isolada no corpo.
- [x] T024 [US1] Executar a suíte completa do backend em SQLite e MySQL 8.4.11;
  parar para a validação do gdev da Fase 3.
  - [x] SQLite: 55 testes/272 asserções nas execuções normal e paralela com
    ordem aleatória (16 processos) em 2026-10-20.
  - [x] MySQL local 8.4.11: schema recriado pelas migrations e suíte completa
    com 55 testes/272 asserções em 2026-10-20.
  - [x] Revisão e finalização solicitadas pelo gdev em 2026-10-20.

**Fase 3 aprovada pelo gdev em 2026-10-20.** A busca mascarada e o pedido de
OTP foram validados em SQLite e MySQL 8.4.11, sem criar sessão autenticada.

## Phase 4: Confirmação, sessão e logout

**Objetivo**: só uma prova válida cria sessão reutilizável; o membro pode
revogá-la.

- [x] T025 [P] [US2] Escrever testes para OTP inválido, expirado, usado,
  tentativas excedidas e resposta genérica sem vazamento de informação;
  comprovar que cada tentativa fica no histórico e que reapresentar o código
  correto após o sucesso registra `already_used` sem criar outra sessão. Cobrir
  e-mail fora de ordem: código antigo com ID antigo e com ID atual, resposta
  `otp_superseded`, vínculo ao pedido cujo hash correspondeu e nenhuma falha
  adicionada ao OTP atual.
- [x] T026 [P] [US2] Escrever teste paralelo de duas confirmações do mesmo OTP,
  verificando que uma única sessão é criada.
- [x] T027 [P] [US2] Escrever testes da sessão stateful Sanctum por cookie,
  CSRF, expiração deslizante centralizada em `SESSION_LIFETIME`, logout e
  logout-all.
- [x] T028 [US2] Implementar `POST /auth/verify` com
  `{ otp_request_id, code }`, transação/concorrência,
  marcos do ciclo da prova em `otp_requests`, uma linha por tentativa em
  `otp_attempts` e tempo até a primeira confirmação aceita; após falha no hash
  atual, testar o conjunto limitado de hashes substituídos recentes do mesmo
  user e registrar `matched_otp_request_id` quando houver correspondência.
- [x] T029 [US2] Criar a sessão Laravel de banco por cookie `HttpOnly`, com 1
  ano deslizante definido apenas por `SESSION_LIFETIME`; criar e encerrar a
  `authenticated_session` durável no login/logout e gravar seu ID no payload da
  sessão; marcar expirações pelo `last_seen_at` usando a mesma duração. Preservar
  PAT e `tokenable_type` somente para futuros clientes externos.
- [x] T030 [US2] Implementar `POST /auth/logout` e `POST /auth/logout-all`
  protegidos por middleware Sanctum.
- [x] T031 [US2] Executar a suíte completa do backend em SQLite e MySQL 8.4.11,
  além das execuções paralela e aleatória; parar para a validação do gdev da
  Fase 4.
  - [x] SQLite: 67 testes aprovados, 1 teste exclusivo de MySQL ignorado e 411
    asserções nas execuções normal e paralela com ordem aleatória (16 processos)
    em 2026-10-21.
  - [x] MySQL local 8.4.11: schema recriado pelas migrations e suíte completa
    com 68 testes/414 asserções em 2026-10-21.
  - [x] Concorrência real no MySQL: duas confirmações em processos separados
    produziram exatamente uma sessão autenticada.
- [x] T031A [US2] Verificar em toda chamada autenticada que o gdev continua
  ativo; ao detectar um gdev não ativo, negar o acesso e encerrar todas as suas
  sessões web, preservando PATs para que também sejam recusados enquanto o status
  permanecer não ativo. Cobrir sessões stateful e PATs com testes automatizados.
  Validado em 2026-10-22 nas suítes completas: SQLite normal e paralela/aleatória
  com 69 testes aprovados, 1 exclusivo de MySQL ignorado e 431 asserções; MySQL
  8.4.11 com 70 testes/434 asserções.

**Implementação da Fase 4 concluída em 2026-10-22 e aguardando validação do
gdev.**

## Phase 5: Modal e integração do frontend

**Objetivo**: o login ocorre sobre a página atual e conserva seu estado.

- [x] T032 [P] [US3] Criar cliente HTTP do frontend cuja base deriva
  `../api/` de `import.meta.env.BASE_URL`, sem variável de ambiente.
- [x] T033 [P] [US3] Escrever testes de interface para abrir/fechar o modal,
  sincronizar `#login`, buscar resultados mascarados e avançar para o OTP.
- [x] T034 [US3] Implementar modal com overlay, busca incremental, seleção do
  usuário, solicitação e confirmação do OTP em `frontend/src`.
- [x] T035 [US3] Implementar estado autenticado no cabeçalho, restauração de
  sessão e ação de logout sem trocar de página.
- [x] T036 [US3] Garantir que a URL reabra o modal/etapa correta e que a página
  de origem permaneça intacta após autenticar.
- [x] T037 [US3] Executar lint, typecheck, build e testes do frontend; parar
  para a validação do gdev da Fase 5.
  - [x] Frontend: 4 arquivos e 11 testes aprovados; lint, typecheck e build de
    produção aprovados em 2026-10-22.
  - [x] Auditoria npm completa, incluindo dependências de desenvolvimento, sem
    vulnerabilidades conhecidas após atualizações patch do lockfile.
  - [x] Validação visual no Chrome em desktop e viewport móvel de 390 × 844:
    modal, overlay, fechamento, preservação de `#sobre`, abertura direta por
    `#login` e retorno seguro de `#login/otp` sem contexto confirmados.
  - [x] Suíte completa do backend em SQLite: 70 testes aprovados, 1 exclusivo
    de MySQL ignorado e 443 asserções.
- [x] T037A [US3] Garantir que falhas inesperadas da API retornem mensagem
  genérica com referência correlacionável, preservem o diagnóstico completo no
  log diário `operational` e exibam essa referência no modal sem vazar detalhes.
- [x] T037B [US3] Disponibilizar seed idempotente com usuários fictícios para
  desenvolvimento local, sem popular o ambiente de produção.
- [x] T037C [US3] Refatorar o frontend de autenticação em uma feature isolada,
  com `LoginDialog` coordenando `UserSearchStep` e `OtpVerificationStep`, sem
  alterar a experiência, URL, contrato HTTP ou política de sessão. Aprovação
  explícita do gdev em 2026-10-23; 14 testes, typecheck, lint e build aprovados
  em 2026-10-23.

**Implementação da Fase 5 concluída em 2026-10-22 e aguardando validação do
gdev.**

**Escopo adicional dos limites globais aprovado pelo gdev em 2026-10-24 e
incorporado à Issue #29; a Issue #56 permanece focada nas demais proteções
contra abuso distribuído.**

