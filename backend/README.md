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
php artisan serve
```

O ambiente local usa SQLite e `MAIL_MAILER=log`; e-mails aparecem em
`storage/logs/laravel.log`. A API fica em `http://localhost:8000`. O frontend
encaminha `/gaydevs/api` para esse endereço durante `npm run dev`.

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
suíte em SQLite e MySQL 8.4; para uma execução MySQL local, configure as
variáveis `DB_*` no `.env` antes de rodar `php artisan migrate:fresh --force` e
`composer test`.

## Produção

O workflow instala as dependências antes do envio e usa um `.env` externo ao
repo. Produção executa somente `php artisan migrate --force`, que aplica
migrations pendentes sem apagar dados; `migrate:fresh` é restrito a
desenvolvimento/CI. Consulte os
[requisitos de hospedagem](../docs/backend-hosting-requirements.md) antes de
instalar ou mover o backend para outro servidor. Valores, comandos e evidências
do ambiente real devem permanecer em registro local não versionado.
