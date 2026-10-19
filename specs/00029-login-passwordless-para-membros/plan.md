# Plan: Login passwordless para membros

**Branch**: `feat/00029-login-passwordless-para-membros` | **Spec**: [spec.md](./spec.md)

**Status**: APROVADO por gdev em 2026-10-17. Pode seguir para tasks e
implementação conforme as fases abaixo.

## Resumo

API Laravel em `backend/` que emite e valida um código OTP de uso único enviado
por e-mail (Mail do Laravel), cria sessão autenticada após a confirmação e
permite encerrá-la. O frontend existente consome a API.

## Contexto técnico

- **Linguagem**: PHP 8.3 (servidor DreamHost: 8.3.30).
- **Framework**: Laravel 13.x (última, `^8.3`; v13.37.0 em 2026-10-16).
- **Autenticação**: Laravel Sanctum 4.x (tokens de API) sobre OTP próprio.
- **E-mail**: Mail do Laravel (Symfony Mailer). Remetente em
  `MAIL_FROM_ADDRESS` (`backend/.env`, ignorado; `.env.example` sem valor).
  Transporte: `sendmail` do host (`/usr/sbin/sendmail -t -i`), decidido após
  POC no DreamHost (envio rápido, sem credenciais). Migrar para SMTP só se a
  entrega falhar; é troca de configuração.
- **Banco**: SQLite no ambiente local e nos testes (`DB_CONNECTION=sqlite`);
  MySQL 8.4 em produção (servidor 8.4.11). Migrations e queries
  devem ser portáveis entre os dois: sem SQL cru específico de um deles.
- **Testes**: Pest/PHPUnit em SQLite (memória), factories para os modelos do
  domínio e `Mail::fake()`. Job extra no CI (GitHub Actions) com serviço
  `mysql:8.4` roda `migrate:fresh` e a suíte com `DB_CONNECTION=mysql`. A
  suíte inclui execução paralela e ordem aleatória para expor dependências e
  condições de corrida.
- **Plataforma**: DreamHost compartilhado, sem Composer no servidor: o deploy
  leva `vendor/` pré-instalado (`composer install --no-dev -o`).
- **Restrições**: `memory_limit` 128M; `composer.json` com
  `config.platform.php = 8.3.30`, igual ao PHP 8.3.30 local, para o lock não
  puxar pacotes incompatíveis com a produção.

## Constitution Check

- Uma feature, uma spec, cobrindo frontend e backend: atende.
- Decisões técnicas ficam neste plan; a spec não foi alterada além do ambiente.
- Aprovação da spec antes do plan: aprovada (ver spec).

## Aprovação humana

Aprovado pelo gdev em 2026-10-17, nesta sessão. Esta aprovação libera a
elaboração das tasks e a implementação; não substitui os gates de revisão e PR.

## Decisões

1. **OTP**: 6 dígitos, guardado como hash, expira em 10 min, uso único e
   limite de 5 tentativas por prova (REQ-004). Sem repetição por membro
   (REQ-010): guardar os hashes anteriores do membro e gerar de novo até o
   código ser inédito. `otp_requests` representa o ciclo de vida da prova;
   `wrong` não é estado da prova. Cada confirmação gera uma linha append-only
   em `otp_attempts`, com resultado `accepted`, `invalid_code`, `expired`,
   `already_used`, `locked`, `superseded` ou `rate_limited`. Reapresentar o
   código correto depois do consumo registra `already_used` e nunca cria uma
   segunda sessão. Ao emitir um novo OTP para o mesmo membro, qualquer pedido
   anterior ainda pendente passa a `superseded`: deixa de ser válido mesmo que
   seu prazo original ainda não tenha terminado. A emissão ocorre em transação,
   bloqueando a linha de `users` com `lockForUpdate` para serializar pedidos
   concorrentes. O pedido antigo guarda `superseded_at` e
   `superseded_by_id`; não é apagado nem depende de log em arquivo.
   Se a tela enviar o ID atual com um código anterior, após falhar contra o
   hash atual o service testa, com `Hash::check`, somente os hashes recentes
   `superseded` do mesmo user. Uma correspondência registra resultado
   `superseded`, mantém em `otp_attempts` o pedido atual e o
   `matched_otp_request_id` antigo, não incrementa `failed_attempts` do pedido
   atual e ainda consome o limite de taxa. Nenhum OTP reversível é persistido.
   O pedido do OTP é auditado como evento separado. Status e resultados são
   enums PHP próprios, usados também pelos casts dos models.
2. **Limites de taxa** (`RateLimiter`): pedidos de OTP, 5/hora por membro e
   20/hora por IP; confirmações limitadas pelas 5 tentativas por prova e por
   IP.
3. **Busca mascarada**: `GET /users?q=` exige ao menos 1 caractere,
   casa pelo início do nome, devolve no máximo 5 itens com `id`, nome e e-mail
   mascarados, nunca o endereço completo (REQ-006), e tem limite de taxa por
   IP. Sem `q`, devolve vazio. O pedido usa o `id` (UUID).
4. **Users**: tabela `users`, que representa os gdevs e é populada manualmente
   após o deploy (REQ-011); sem cadastro pela aplicação (REQ-001). O campo `status` aceita
   `active` ou `inactive`; somente membros ativos podem iniciar o login.
   **Identificadores**: toda tabela com id exposto ao frontend usa UUID (v7,
      ordenável) como chave primária, nunca inteiro sequencial. Aqui: `users`,
      `visitors` e `otp_requests`. Entidades internas e potencialmente volumosas
      (`visits`, observações, IPs, versões GeoIP, sessões auditáveis e tentativas
      de OTP) usam `BIGINT` incremental. Tabelas nativas do Laravel preservam
      seus formatos.
5. **Visitantes**: `visitors` guarda o UUID v7 pseudônimo emitido pelo backend
   em cookie first-party `HttpOnly`. O navegador envia o cookie automaticamente
   também nas chamadas de telemetria do frontend; não existe um identificador
   paralelo no JavaScript. Na primeira carga, o frontend deve aguardar a resposta
   da primeira chamada ao backend antes de disparar outras chamadas em paralelo;
   eventos produzidos nesse intervalo ficam em memória. Isso evita que requisições
   simultâneas ainda sem o cookie criem visitantes distintos. IP/User-Agent não
   identificam visitantes.
   `visits` delimita uma janela de atividade de 30 minutos. Cada chamada cria
   uma linha append-only
   em `visitor_observations`, com User-Agent integral, derivados, idioma,
   referer, método, caminho e horário. `otp_requests` e `otp_attempts` apontam
   para sua observação exata. Cada chamada autenticada aponta diretamente para
   `authenticated_sessions` ou `personal_access_tokens`; as visitas de uma
   credencial são obtidas pelos `visit_id` distintos dessas observações, sem
   tabelas de resumo N:N.
   `ip_addresses` centraliza o IP. `ip_geolocations` mantém snapshots com
   país, cidade, ASN, `geo_status`, período de validade, data da resolução,
   tipo e `buildEpoch` das bases City/ASN. Cada observação aponta para o
   snapshot vigente, preservando mudanças de cidade do mesmo IP. Um snapshot
   resolvido vale por 24 horas; indisponibilidade, erro ou base stale são
   tentados novamente após 60 minutos. `geoip:update` força nova conferência
   de todos os IPs após atualizar as bases.
   O IP é registrado por segurança do site (detecção de abuso e ataques),
   decisão do gdev. O IP completo é mantido por 90 dias e depois truncado
   (IPv4 /24, IPv6 /48) por tarefa agendada; os derivados (país, cidade, ASN)
   permanecem. O ciclo da prova registra seus marcos temporais, enquanto
   `otp_attempts` preserva os resultados individuais e o tempo até a primeira
   confirmação aceita (REQ-014). Coleta com script no frontend e aviso LGPD:
   Issue #37.
   As bases `.mmdb` ficam fora da pasta substituída pelo deploy. O scheduler
   executa `geoip:update` diariamente às 04:00 quando habilitado, mantém a
   aplicação operacional se a base faltar, alerta após 7 dias e não faz novos
   enriquecimentos com base acima de 30 dias.
6. **Sessão**: a SPA própria usa a autenticação stateful do Sanctum sobre a
   sessão e o cookie `HttpOnly` do Laravel; PAT permanece disponível para
   futuros clientes externos e mantém o `tokenable_type` nativo. A duração
   deslizante de 90 dias da sessão web tem uma única fonte de verdade:
   `SESSION_LIFETIME=129600`. O Laravel renova a atividade no uso; não existe
   um segundo `expires_at` de PAT para a mesma sessão web. Logout revoga a
   sessão atual e "sair de todos os dispositivos" revoga todas as sessões do
   membro (REQ-005). A tabela efêmera `sessions` permanece no formato esperado
   pelo Laravel. `authenticated_sessions` guarda o ciclo auditável do login por
   um ID interno armazenado no payload da sessão, sem persistir o ID secreto do
   cookie; logout e expiração encerram esse registro sem apagar seu histórico.
7. **E-mail**: OTP no assunto e sozinho em linha própria no corpo em texto
   (REQ-007). Sem markup oficial do Gmail para OTP; verificar em e-mail real.
8. **Contrato da API**: não criar coleção Postman, OpenAPI ou outro contrato
   versionado nesta feature. Os endpoints e payloads deste plan são a referência
   suficiente para o escopo atual.
9. **Camada HTTP**: validar entradas em Form Requests reutilizáveis; controllers
   só orquestram o caso de uso. Middleware do Sanctum protege logout, logout-all
   e futuras rotas autenticadas, sem duplicar verificações de token nos
   controllers.
10. **Concorrência e qualidade**: cobrir com teste paralelo a confirmação
    simultânea do mesmo OTP, garantindo que só uma sessão seja criada. Cobrir
    também expiração, reutilização, limite de tentativas e limites de taxa. Os
    checks de lint, audit, testes SQLite e MySQL executam a cada push; o audit
    também roda semanalmente. Docker permanece fora desta feature, na Issue #39.
11. **Agendamento**: a aplicação usa `America/Sao_Paulo`. A infraestrutura de
    cada instalação deve acionar `php artisan schedule:run` a cada minuto; o
    Laravel decide quando rodar a anonimização diária às 03:00. Instalação,
    requisitos para qualquer instalação ficam em
    `docs/backend-hosting-requirements.md`; valores, comandos e evidências do
    ambiente real ficam fora do Git.
    Toda tarefa agendada registra início, sucesso, falha ou salto num canal
    diário dedicado, com retenção configurável.

## Contrato da API (esboço)

- `GET /ping` → 200 `pong` (sem dados; verificação de deploy e do rewrite).
- `GET /users?q=L` → até 5 × { id (UUID), name, email } mascarados.
- `POST /auth/otp` { user_id (UUID) } → 202 com
  `{ otp_request_id, expires_at }`; ainda não autentica.
- `POST /auth/verify` { otp_request_id (UUID), code } → valida exatamente o
  desafio indicado; em sucesso responde 204 e envia a sessão no cabeçalho
  `Set-Cookie`; em falha responde 422 sem expor dados do user. Código
  reconhecido como pertencente a pedido substituído responde
  `{ message, reason: "otp_superseded" }`; as demais falhas permanecem
  genéricas.
- `POST /auth/logout` (autenticado) → 204.
- `POST /auth/logout-all` (autenticado) → 204; revoga todas as sessões.

Caminhos relativos à base `/gaydevs/api/`.

## CI e deploy do backend

Workflows em `.github/workflows/` (adaptados do projeto roadmap, PHP 8.3,
`working-directory: backend`, gatilhos por `backend/**`):
- `backend-lint.yml`, `backend-audit.yml`, `backend-test.yml` (matriz SQLite e
  MySQL 8.4) e `backend-deploy.yml` (SFTP/SSH no DreamHost), mais a action
  `.github/actions/composer-cache`.
- O app Laravel deve fornecer: script `composer lint` (Pint), `.env.example`
  e `DB_CONNECTION` configurável por ambiente.
- Deploy: aplicação e `.env` persistente usam caminhos configurados no workflow
  e no host; o `.env` deve existir fora da pasta substituída antes do primeiro
  deploy. Os valores efetivos permanecem no registro não versionado do ambiente.
- A ativação e a verificação do scheduler em cada instalação seguem
  `docs/backend-hosting-requirements.md`.
- URLs de produção: frontend em `https://vettoretti.dev/gaydevs/platform/`,
  API em `https://vettoretti.dev/gaydevs/api/` e `/gaydevs/` redireciona para
  o frontend (`.htaccess` escrito pelo deploy do frontend). Mesma origem: sem
  CORS. O frontend usa `base: '/gaydevs/platform/'` no Vite.
- O app Laravel inteiro é implantado em `/gaydevs/api/` (sem link simbólico
  nem pasta fora da raiz web). O deploy escreve um `.htaccess` na raiz do app
  (`Options -Indexes` e rewrite de todo pedido para `public/`); assim
  `vendor/`, `storage/`, `.env` e demais pastas nunca são servidos, e a URL
  nunca contém `/public/` (o caminho `/gaydevs/api/public/...` não é usado e
  retorna 404). Padrão validado no roadmap, no mesmo servidor: `/ping` 200,
  `composer.json`, `vendor/`, `artisan`, `app/` e `storage/` 404, `.env` 403.
  Exige um ajuste no `public/index.php`: depois do rewrite, o Laravel ainda
  vê `SCRIPT_NAME` em `/public/` e devolve 404 nas rotas; o app deve apontar
  `SCRIPT_NAME` e `PHP_SELF` para a raiz do app. Verificar os mesmos caminhos
  no primeiro deploy do gaydevs.

  Trecho validado no projeto "vizinho de servidor de produção" roadmap, em `backend/public/index.php`, antes do
  `require` do autoloader:

  ```php
  // Atrás do rewrite do .htaccess a URL não tem /public/; aponta SCRIPT_NAME
  // para a raiz do app para o Laravel detectar a base corretamente.
  $publicDir = dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php');
  if ($publicDir !== '/' && ! str_starts_with($_SERVER['REQUEST_URI'] ?? '', $publicDir.'/')) {
      $_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = dirname($publicDir).'/index.php';
  }
  ```

  Testes de feature rodam sem o `index.php`, então cobrir com um teste ou com
  a verificação manual de `/gaydevs/api/ping` no primeiro deploy.
- O prefixo `api` do Laravel é desativado (`apiPrefix: ''` em
  `bootstrap/app.php`), pois a API já vive em `/gaydevs/api/`.
- Checks `audit`, `lint`, `test (sqlite)` e `test (mysql)` rodam em todo push.
  Pendente (depois do primeiro push com os workflows): verificar no PR se um
  check com falha já bloqueia o merge sem configuração extra (a memória do
  gdev é que sim; hoje nenhuma branch protegida deste repo exige status
  checks, e o repo do roadmap não tem proteção). Se não bloquear, marcar os
  4 checks como obrigatórios na proteção de `develop` (e `main`) via
  `gh api`.

## Ambiente local (backend)

Prod roda PHP 8.3.30; o gdev instala o mesmo PHP localmente, sem Docker (o
ambiente Docker fica na Issue #39).
- **Instalação documentada no README do `backend/`**, versão fixa 8.3.30 (NTS)
  em uma pasta própria por versão (Windows: `C:\PHP\8.3.30\nts\x64`), com o
  `php.ini` ajustado (extensões `curl`, `fileinfo`, `mbstring`, `openssl`,
  `pdo_mysql`, `pdo_sqlite`, `zip`; `memory_limit` 128M) e a pasta no PATH,
  de preferência por um link (junção) `current`, que permite trocar de versão
  sem editar o PATH. Linux e macOS: pacote `php8.3` (PPA ondrej / Homebrew).
- Validação: `php -v` deve mostrar 8.3.30; `php -m` lista as extensões;
  `composer check-platform-reqs` confere o projeto.
- `composer.json` com `config.platform.php: 8.3.30`, para o lock ser
  compatível com prod; o CI roda 8.3.
- Dev local: SQLite, `MAIL_MAILER=log` (o OTP aparece em
  `storage/logs/laravel.log`) e `php artisan serve` na porta 8000. O proxy
  versionado em `frontend/vite.config.ts` encaminha `/gaydevs/api` para
  `http://localhost:8000` somente durante `npm run dev`.
- **Xdebug** (opcional, só em dev): `xdebug.mode=debug`,
  `start_with_request=trigger`, porta 9003. O repo versiona
  `.vscode/launch.json` ("Listen for Xdebug", porta 9003) e
  `.vscode/extensions.json` (`xdebug.php-debug`); o `.gitignore` deve liberar
  só esses dois arquivos de `.vscode/`.
- MySQL local é opcional (qualquer 8.4 instalado pelo gdev); o CI já valida as
  migrations em MySQL 8.4.

## Fases de execução

Cada fase termina com validação do gdev. O agente não adiciona arquivos ao
stage nem cria commit sem pedido explícito:
1. Ambiente local: `composer.json`, README com instalação do PHP, `.vscode`.
2. Esqueleto do Laravel: configuração, `apiPrefix: ''`, e-mail e o ajuste de
   `SCRIPT_NAME` no `public/index.php`.
3. Banco: migrations, models e factories (UUID v7 público e `BIGINT` interno),
   validados em SQLite e MySQL.
4. Pedido de OTP: busca mascarada, limites e e-mail.
5. Verificação do OTP e sessão (Sanctum): logout e logout-all.
6. Visitantes e IP.
7. Popup `#login` e estado logado no cabeçalho.

## Estrutura

```text
backend/
├── app/{Models,Http/Controllers/Auth,Mail,Services}
├── database/migrations/
├── routes/api.php
├── tests/{Feature,Unit}
├── .env.example
├── composer.json        # com o script `lint` (Pint)
frontend/           # popup de login (modal com overlay) sincronizado com a URL
                    # (hash `#login`); sem navegação de tela

Configuração do frontend: esta feature não usa `.env` nem `.env.example` no
frontend. Não há segredo válido para o bundle do navegador. A base da API é
derivada relacionalmente de `../api/` a partir de `import.meta.env.BASE_URL`;
com `base: '/gaydevs/platform/'`, resolve para `/gaydevs/api/` sem depender da
rota/tela atual. Em desenvolvimento, `server.proxy` em `vite.config.ts`
(arquivo versionado) encaminha esse caminho para `http://localhost:8000`;
esse proxy não existe no build de produção. Em produção, o navegador chama a
API de mesma origem diretamente.
```

## UI (frontend)

Popup de login (REQ-013) e estado logado no cabeçalho (nome e "sair"). "Sair
de todos os dispositivos" existe só como endpoint da API; sem página
"Minhas sessões" nesta feature.
