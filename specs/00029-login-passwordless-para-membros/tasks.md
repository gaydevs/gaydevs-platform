# Tasks: Login passwordless para membros

**Input**: [spec.md](./spec.md) e [plan.md](./plan.md)

**Pré-requisitos**: spec e plan aprovados; Issue #29 sem blockers.

**Regra de execução**: concluir e validar cada fase antes da próxima. O agente
não adiciona arquivos ao stage nem cria commit sem pedido explícito do gdev.

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
  validar a matriz SQLite/MySQL 8.4.
- [ ] T017 Executar migrations e testes de fundação em SQLite e MySQL; parar
  para a validação do gdev da Fase 2.
  - [x] SQLite local: migrations e 36 testes/125 asserções nas execuções normal,
    paralela (4 processos) e aleatória.
  - [ ] MySQL 8.4: aguarda execução do workflow após publicação.
  - [ ] Validação manual do gdev.

