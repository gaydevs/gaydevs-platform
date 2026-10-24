# Backend da plataforma gaydevs

API Laravel da plataforma gaydevs.

## Requisitos

- PHP 8.3.30 NTS x64;
- Composer 2;
- extensões `curl`, `fileinfo`, `mbstring`, `openssl`, `pdo_mysql`,
  `pdo_sqlite` e `zip`.

No Windows, a instalação recomendada fica em `C:\PHP\8.3.30\nts\x64`, com
`C:\PHP\current` como junção para a versão ativa e no `PATH`. Confirme com:

```powershell
php -v
php -m
composer check-platform-reqs
```

Em Linux, use um pacote `php8.3` compatível com a distribuição. No macOS, use
o PHP 8.3 do Homebrew. O `composer.lock` é resolvido com
`config.platform.php=8.3.30`, a mesma versão da produção.

## Desenvolvimento local

```powershell
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

O ambiente local usa SQLite e `MAIL_MAILER=log`; e-mails aparecem em
`storage/logs/laravel.log`. A API fica em `http://localhost:8000`. O frontend
encaminha `/gaydevs/api` para esse endereço durante `npm run dev`.

O fluxo de OTP possui limites globais configuráveis além dos limites por usuário
e por IP: `PASSWORDLESS_GLOBAL_OTP_MAX_ATTEMPTS` controla quantos OTPs podem ser
gerados na janela `PASSWORDLESS_GLOBAL_OTP_DECAY_SECONDS`, e
`PASSWORDLESS_GLOBAL_EMAIL_MAX_ATTEMPTS` controla quantos envios de e-mail são
autorizados na janela `PASSWORDLESS_GLOBAL_EMAIL_DECAY_SECONDS`. Os padrões são
100 por hora para cada contador. O cache precisa ser compartilhado entre as
instâncias do backend; não use um cache local por processo em produção.

No hosting compartilhado, o DreamHost documenta 200 destinatários por hora para
PHP/CGI/Sendmail no servidor compartilhado e 100 destinatários por hora por
endereço quando se usa SMTP autenticado. O limite da aplicação fica em 100 por
hora por padrão para manter margem e não substitui o limite do provedor.
Os módulos que precisarem enviar mensagens devem usar o serviço central
`App\Services\EmailSender`; ele reserva a cota, lança
`EmailRateLimitExceededException` quando o envio é bloqueado e registra o evento
no log operacional.

O Vite escuta na LAN por padrão. Para testar pelo celular, inicie o frontend
com `npm run dev` e abra a URL `Network` exibida pelo Vite, por exemplo
`http://192.168.15.90:5173/gaydevs/platform/`. Acrescente esse host ao
`SANCTUM_STATEFUL_DOMAINS` do `.env` do backend e limpe a configuração:

```env
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,localhost,127.0.0.1,192.168.15.90:5173,192.168.15.90
```

```powershell
php artisan config:clear
```

Substitua `192.168.15.90` pelo IPv4 do computador na rede atual. No Windows,
consulte-o com `ipconfig`. O backend pode continuar em `127.0.0.1:8000`, pois
o celular acessa a API pelo proxy do Vite.

O seed padrão só roda quando `DEVELOPMENT_SEED_ENABLED=true`, cria dez usuários
fictícios em domínios `.test` distintos (nove ativos e um não ativo) e pode ser
repetido sem duplicar registros. Para usar um MySQL local no backend, configure
`DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` e
`DB_PASSWORD` no ambiente local e execute:

Os usuários gerados ficam na tabela `users`; consulte-a pelo cliente ou
servidor do banco escolhido para o ambiente.

```powershell
php artisan migrate:fresh --seed --force
php artisan serve --host=127.0.0.1 --port=8000
```

Também é possível repetir somente o seed com `php artisan db:seed`. Produção
não recebe esses dados.

### Testar com MySQL sem apagar o banco de desenvolvimento

Os testes usam `RefreshDatabase`, que pode recriar todas as tabelas do banco
selecionado. Por isso, nunca execute a suíte apontando para o banco usado pelo
backend em desenvolvimento. Crie um arquivo local ignorado, por exemplo
`backend/.env.mysql.testing`, copiando as credenciais do ambiente local e
alterando apenas `APP_ENV=mysql-testing` e `DB_DATABASE=gaydevs_test`. Crie
`gaydevs_test` uma vez no servidor MySQL e rode:

```powershell
php artisan test --env=mysql.testing
```

O comando acima pode limpar e recriar somente `gaydevs_test`; os dados do banco
de desenvolvimento permanecem isolados. Não use `--env=mysql` para a suíte.

### Consultar o OTP em desenvolvimento

O seed não cria OTP. Depois de selecionar um usuário no frontend e solicitar
um código, o desenvolvimento usa `MAIL_MAILER=log`; o código aparece em
`backend/storage/logs/laravel.log`:

```powershell
Get-Content .\storage\logs\laravel.log -Wait
```

O `.env` não é versionado. Defina `MAIL_FROM_ADDRESS` localmente e nunca grave
o endereço real em código ou documentação versionada.

### Teste manual inicial

Depois de iniciar o backend com `php artisan serve` e o frontend com
`npm run dev`, o gdev pode validar:

- frontend: `http://127.0.0.1:5173/gaydevs/platform/`;
- API pelo proxy do Vite: `http://127.0.0.1:5173/gaydevs/api/ping`;
- API Laravel diretamente: `http://127.0.0.1:8000/ping`.

Os dois endereços de ping devem responder `pong`. O proxy existe apenas no
servidor de desenvolvimento do Vite; no build de produção o navegador acessa
`/gaydevs/api/` diretamente na mesma origem.

### Depurar PHP com Xdebug

O PHP local deve carregar o Xdebug e usar a porta `9003`. No Windows, confirme
a instalação efetiva com:

```powershell
php --ini
php -v
php -i | Select-String "xdebug.mode|xdebug.start_with_request|xdebug.client_host|xdebug.client_port"
```

Para o desenvolvimento, configure no `php.ini` usado pelo comando `php`
(`C:\PHP\current\php.ini`, quando essa junção estiver configurada):

```ini
xdebug.mode=debug
xdebug.start_with_request=yes
xdebug.client_host=127.0.0.1
xdebug.client_port=9003
```

Inicie no VS Code o perfil `Listen for Xdebug` e depois execute:

```powershell
php artisan serve --host=127.0.0.1 --port=8000
```

Com `xdebug.start_with_request=yes`, as chamadas feitas pelo navegador local
ou pelo celular na LAN podem atingir os breakpoints sem adicionar
`XDEBUG_TRIGGER` à URL. Essa opção inicia o Xdebug em toda requisição e deve
ficar restrita ao PHP de desenvolvimento; não use essa configuração em
produção.

### GeoIP local

País, cidade e ASN são opcionais e consultados sem chamadas externas. Para
ativá-los, baixe as bases MaxMind compatíveis e informe seus caminhos locais em
`GEOIP_CITY_DATABASE` e `GEOIP_ASN_DATABASE` no `.env`. Se uma base estiver
ausente ou não contiver o IP, esses campos permanecem vazios. Tipo e data de
construção das bases acompanham cada resolução. `geoip:update` usa o
`geoipupdate` externo quando provisionado; configuração local e de produção
deve respeitar os [requisitos de hospedagem](../docs/backend-hosting-requirements.md).
Resoluções ficam em snapshots: o mesmo IP pode ter cidades diferentes em
momentos diferentes. O cache normal vale 24 horas e falhas são tentadas
novamente após 60 minutos.

A suíte contém um teste funcional com `8.8.8.8`: ele usa os arquivos reais
quando estão instalados e é marcado como skipped em ambientes, como o CI, que
não possuem as bases privadas.

## Verificações

O backend aceita os dois estilos de teste: Pest (`test(...)` e `expect(...)`)
e classes PHPUnit (`TestCase` e métodos `test*`). Ambos rodam pela mesma suíte:

```powershell
composer lint
composer test
composer test:parallel
composer test:random
composer audit --locked
```

Os testes locais usam SQLite. O workflow `Backend Test` repete migrations e a
suíte em SQLite e MySQL 8.4. Para uma execução MySQL local, use o ambiente
isolado descrito acima (`php artisan test --env=mysql.testing`); nunca aponte a
suíte para o banco de desenvolvimento.

## Produção

O workflow instala as dependências antes do envio e usa um `.env` externo ao
repo. Produção executa somente `php artisan migrate --force`, que aplica
migrations pendentes sem apagar dados; `migrate:fresh` é restrito a
desenvolvimento/CI. Consulte os
[requisitos de hospedagem](../docs/backend-hosting-requirements.md) antes de
instalar ou mover o backend para outro servidor. Valores, comandos e evidências
do ambiente real devem permanecer em registro local não versionado.
