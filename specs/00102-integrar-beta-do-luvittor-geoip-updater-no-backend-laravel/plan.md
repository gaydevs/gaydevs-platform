# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/102 · [Spec](spec.md)
Fast-track Low (beta confinada a branch/PR, atualização desabilitada por padrão).

## Implementação

1. `composer.json` declara VCS `https://github.com/luvittor/geoip-updater`
   e requer `v0.1.0-beta.1`; atualizar somente lock necessário.
2. Registrar bindings de contrato `Transport` e `DatabaseValidator` no
   `AppServiceProvider`; `GeoIpPackageUpdater` adapta config em
   `UpdateOptions` com edições City/ASN.
3. O comando só resolve o adaptador após `geoip.update_enabled`. Uma resposta
   `failed`, incompleta ou com edição inesperada falha antes da atualização
   de geolocalizações. Logs/CLI usam mensagens constantes sanitizadas.
4. Reutilizar leitura GeoIP existente, remover updater/downloader/validator
   duplicados; preservar avisos por data de construção.
5. Testar com `Transport`/`DatabaseValidator` falsos, arquivos tar gerados
   localmente e diretórios descartáveis; sem MaxMind real ou credenciais.

## Limites conhecidos

- A beta substitui o lock configurável `GEOIP_UPDATE_LOCK_FILE` por
  `.geoipupdate.lock` no diretório persistente; README informa isso.
- Instalação da versão beta gera sidecars `.version`; migração de bases
  existentes sem sidecar causa novo download na primeira execução.
- O pacote não promete atomicidade global City/ASN após queda de processo.
- Sem homologação de produção nem validação com credenciais reais.

## Validação

- Composer strict validate, testes PHP focais, `composer test`,
  `composer lint`, paralelo aleatório e CI oficial em SQLite/MySQL.
