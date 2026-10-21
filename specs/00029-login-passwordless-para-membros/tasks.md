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

