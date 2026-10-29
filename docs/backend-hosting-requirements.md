# Requisitos de hospedagem do backend

Este documento descreve somente as dependências que uma instalação do backend
deve fornecer. Caminhos, credenciais, comandos específicos, estado e evidências
de um ambiente real não pertencem ao Git e devem ser registrados separadamente.

## Runtime e servidor web

- PHP 8.3 compatível com o `composer.lock`; o projeto fixa
  `config.platform.php` em 8.3.30.
- Extensões requeridas pelo Laravel e pelo projeto, incluindo `ctype`, `curl`,
  `dom`, `fileinfo`, `filter`, `hash`, `intl`, `mbstring`, `openssl`, `PDO`,
  `pdo_mysql`, `session`, `sodium`, `tokenizer` e `xml`.
- MySQL acessível pela aplicação e credenciais fornecidas apenas pelo ambiente.
- Dependências de produção do Composer instaladas antes da ativação do release;
  se o host não tiver Composer, o artefato de deploy deve incluir `vendor/`.
- Apenas `backend/public/` pode ser exposto. Quando o provedor não permitir
  configurar o document root, o rewrite deve impedir acesso a `.env`, `vendor/`,
  `storage/`, `app/`, `artisan` e `composer.json`.
- `storage/` e `bootstrap/cache/` precisam ser graváveis pelo processo PHP.

## Topologia frontend ↔ API

A publicação atual assume **mesma origem** e diretórios irmãos para frontend e
backend. O contrato estrutural é:

```text
platform/
../api/
```

Esse caminho relativo está deliberadamente acoplado em dois pontos de runtime e
**ambos precisam ser atualizados juntos se a API for migrada**:

1. o React, em `frontend/src/features/auth/api.ts`, usa `../api/` em
   `resolveApiBase()` para derivar a base da API a partir de `BASE_URL`;
2. o Apache, em `frontend/public/.htaccess`, usa `../api/social/preview/...` para
   entregar HTML com metadata a crawlers sociais.

Além disso, o ambiente de desenvolvimento possui `/gaydevs/api` no proxy do
Vite (`frontend/vite.config.ts`). Esse terceiro ponto também deve ser revisado
quando o path público da API mudar.

O backend usa `APP_FRONTEND_URL` para gerar URLs públicas de canonical e imagens
de social preview. Portanto, uma migração de hospedagem deve revisar em conjunto:

- `resolveApiBase()` no React;
- o destino `../api/` do `.htaccess`;
- o proxy de desenvolvimento do Vite;
- `APP_URL` e `APP_FRONTEND_URL` no `.env` persistente.

Se frontend e API deixarem de compartilhar a mesma origem/topologia de
diretórios irmãos, `../api/` deixa de ser válido. Nesse cenário, não altere
apenas uma das referências: defina antes a nova estratégia de roteamento
(configuração explícita, reverse proxy/edge ou equivalente), atualize os pontos
acima e valide tanto requisições normais do React quanto previews de crawlers.

## Configuração e dados persistentes

- O `.env` de produção fica fora do Git e fora da pasta descartada pelo deploy.
- `APP_KEY` deve permanecer estável entre releases e migrações de host; trocá-la
  invalida dados criptografados e cookies existentes.
- Banco de dados e arquivos persistentes devem ser preservados durante o deploy.
- Produção executa somente `php artisan migrate --force`. Não executar
  `migrate:fresh`, `db:wipe` ou qualquer limpeza automática do banco.
- Antes de trocar de servidor, deve existir backup restaurável do banco e dos
  arquivos externos usados pela instalação.

## Scheduler

O host deve executar `php artisan schedule:run` a cada minuto. O Laravel usa
`America/Sao_Paulo` para decidir os horários e atualmente agenda:

- `visitors:anonymize-ips` diariamente às 03:00;
- `geoip:update` diariamente às 04:00, quando habilitado;
- `smtp:keepalive` diariamente às 00:00.

Na DreamHost, cadastre o cron via SSH (`crontab -e`); o formulário do painel não
oferece a frequência de um minuto exigida pelo scheduler:

```cron
* * * * * cd /home/USUARIO/APP/backend && /usr/local/php83/bin/php artisan schedule:run >> /home/USUARIO/logs/gaydevs-scheduler.log 2>&1
```

Troque os caminhos e confira com `crontab -l`. [Instruções da DreamHost](https://help.dreamhost.com/hc/en-us/articles/215767047-Creating-a-custom-Cron-Job).

Use caminhos absolutos, deixe o e-mail vazio se a saída for redirecionada e
mantenha o locking habilitado quando disponível.
Ao escolher o `crontab` via SSH, não mantenha cron gerenciado pelo painel para o
mesmo usuário: atualizações no painel sobrescrevem personalizações do arquivo.
O deploy verifica essa entrada antes de trocar o release. Se ela faltar, execute
manualmente o workflow `Provision Backend Scheduler` e reexecute o deploy; o
provisionamento é idempotente e não substitui entradas conflitantes.

Cada instalação deve validar `php artisan schedule:list`, uma execução manual e
o canal diário `storage/logs/scheduler-*.log`. O host também deve impedir
execuções simultâneas do cron quando oferecer esse controle; a aplicação usa
`withoutOverlapping` como proteção adicional.

## E-mail

O host deve oferecer um transporte compatível com Symfony Mailer. Para a
integração transacional do gdevs, use SMTP da Brevo com TLS na porta 587 e
mantenha estes valores somente no `.env` externo:

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=tls
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=<SMTP_LOGIN>
MAIL_PASSWORD=<SMTP_KEY>
MAIL_FROM_ADDRESS=<VERIFIED_SENDER>
MAIL_FROM_NAME="gdevs"
```

O desenvolvimento começa com `MAIL_MAILER=log`; o modo SMTP só deve ser
ativado temporariamente para um teste controlado. O remetente/domínio precisa
estar autenticado na Brevo.

O plano Free informa cota de 300 envios por dia. Para não depender do horário
de virada ou da fila de retry da Brevo, a aplicação reserva globalmente no
cache compartilhado no máximo 150 envios por hora e 250 envios em uma janela
móvel de 24 horas. Esses limites incluem o keepalive e devem ser mantidos
abaixo da cota do provedor.

O scheduler diário executa `smtp:keepalive` às 00:00. O comando não envia
quando o mailer efetivo é `log` ou quando ainda não existe um envio SMTP aceito
registrado. Depois de 80 dias sem envio SMTP aceito, ele envia uma mensagem
técnica para `MAIL_FROM_ADDRESS`; o timestamp persistido fica em
`smtp_transport_states`. A tarefa usa `withoutOverlapping`, e falhas ficam no
log operacional sem registrar credenciais, OTP, conteúdo ou endereço completo.

Antes do primeiro uso SMTP, confirme no painel da Brevo que a plataforma
transacional está habilitada para a conta e que a chave SMTP está ativa. Isso
é um estado da conta/provedor, não uma configuração adicional no código; o
teste controlado de entrega confirma a ativação efetiva.

### Teste manual de entrega

No desenvolvimento:

1. confirme `MAIL_MAILER=log` e execute `php artisan config:clear`;
2. altere temporariamente o `.env` externo para os valores SMTP acima;
3. execute `php artisan config:clear` e solicite um único OTP para um
   destinatário controlado;
4. confirme recebimento, remetente e evento no painel transacional da Brevo;
5. restaure `MAIL_MAILER=log` e execute novamente `php artisan config:clear`.

Em produção, confirme os mesmos pré-requisitos no `.env` externo. Se esse
arquivo foi alterado depois do último deploy, execute um novo deploy antes do
teste para que o arquivo seja recopiado e o cache seja recriado com
`php artisan config:cache`; sem isso, a aplicação pode continuar usando valores
SMTP antigos. Depois, faça um único pedido de OTP para um destinatário
controlado e valide recebimento, remetente e evento transacional. Registre fora
do Git somente ambiente, data, resultado e referência operacional não sensível.
Nunca registre chave SMTP, senha, OTP ou destinatário completo.

## GeoIP opcional

A aplicação funciona sem GeoIP, mas país, cidade e ASN ficam indisponíveis. Para
habilitar atualização automática, o host deve fornecer:

- bases `GeoLite2-City.mmdb` e `GeoLite2-ASN.mmdb` em diretório persistente;
- credenciais MaxMind (`GEOIP_ACCOUNT_ID` e `GEOIP_LICENSE_KEY`) no `.env`
  externo, protegido e fora do Git;
- caminhos `GEOIP_*` no `.env` externo;
- saída de rede para o download da MaxMind;
- timeout e tentativas de download (`GEOIP_DOWNLOAD_TIMEOUT_SECONDS`,
  `GEOIP_DOWNLOAD_RETRY_ATTEMPTS` e
  `GEOIP_DOWNLOAD_RETRY_SLEEP_MILLISECONDS`) compatíveis com a rede do host.

As bases não podem ficar na pasta substituída pelo deploy. O diretório configurado
em `GEOIP_DATABASE_DIRECTORY` não precisa ser criado manualmente: na primeira
execução, `geoip:update` cria esse caminho persistente quando ele ainda não existe
e valida que é gravável. O comando baixa os arquivos em uma área temporária,
valida tipo e data de construção, faz a troca atômica, alerta depois de 7 dias e
não instala bases acima de 30 dias. Resultados normais são reutilizados por 24 horas; estados
indisponíveis são tentados após 60 minutos. Credenciais, respostas e conteúdo
de download não são registrados nos logs. Se o enriquecimento GeoIP falhar
durante uma requisição, a observação continua sendo gravada sem a referência de
geolocalização; o detalhe técnico é registrado em `operational.log`.

## Gate de CI para liberação

Na regra de proteção de cada branch que recebe mudanças do backend, habilite
**Require status checks to pass before merging** e selecione exclusivamente
**`CI Required`**. O workflow orquestrador `CI` executa os checks obrigatórios
do projeto; seu job final `CI Required` falha quando qualquer um deles falha,
é cancelado ou é ignorado. Não selecione os jobs individuais.

## Validação de uma instalação ou migração

Antes de considerar um host pronto, o gdev deve:

1. conferir PHP, extensões e `composer check-platform-reqs`;
2. provisionar o `.env` persistente sem alterar `APP_KEY` inadvertidamente;
3. conferir conexão e backup do MySQL;
4. instalar o release e executar `php artisan migrate --force`;
5. validar permissões, cache, `/ping` e a indisponibilidade dos caminhos
   sensíveis;
6. ativar e verificar o scheduler;
7. provisionar e validar e-mail, incluindo um teste SMTP controlado em dev e
   produção;
8. provisionar GeoIP, quando habilitado;
9. registrar fora do Git os valores, comandos, responsáveis, datas e evidências
   específicos daquele ambiente.
