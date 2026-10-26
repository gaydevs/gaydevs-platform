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
- `geoip:update` diariamente às 04:00, quando habilitado.

Há duas opções na DreamHost:

- **Painel:** permite até 12 minutos personalizados. `Every 10 minutes` serve
  apenas para teste; o bloco `DREAMHOST BLOCK` não deve ser editado manualmente.
- **SSH:** use `crontab -e` para o intervalo correto:

  ```cron
  * * * * * cd /home/USUARIO/APP/backend && /usr/local/php83/bin/php artisan schedule:run >> /home/USUARIO/logs/gaydevs-scheduler.log 2>&1
  ```

  Troque os caminhos e confira com `crontab -l`. [Instruções da DreamHost](https://help.dreamhost.com/hc/en-us/articles/215088668-Create-a-cron-job).

Use caminhos absolutos, deixe o e-mail vazio se a saída for redirecionada e
mantenha o locking habilitado quando disponível.

Cada instalação deve validar `php artisan schedule:list`, uma execução manual e
o canal diário `storage/logs/scheduler-*.log`. O host também deve impedir
execuções simultâneas do cron quando oferecer esse controle; a aplicação usa
`withoutOverlapping` como proteção adicional.

## E-mail

O host deve oferecer um transporte compatível com Symfony Mailer: SMTP ou
`sendmail`. A instalação precisa configurar `MAIL_*`, remetente, SPF e DKIM e
validar entrega real do OTP antes de liberar autenticação em produção.

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

As bases não podem ficar na pasta substituída pelo deploy. O comando
`geoip:update` baixa os arquivos em uma área temporária, valida tipo e data de
construção, faz a troca atômica, alerta depois de 7 dias e não instala bases
acima de 30 dias. Resultados normais são reutilizados por 24 horas; estados
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
7. provisionar e validar e-mail;
8. provisionar GeoIP, quando habilitado;
9. registrar fora do Git os valores, comandos, responsáveis, datas e evidências
   específicos daquele ambiente.
