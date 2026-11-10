# 00102 — Integrar a beta do luvittor/geoip-updater no backend

Issue: https://github.com/gaydevs/gaydevs-platform/issues/102
Estado: fast-track Low Risk; execução limitada a branch e PR para develop, sem release ou deploy.

## Objetivo

Substituir o atualizador GeoIP próprio por um adaptador Laravel mínimo que consome
a tag imutável `v0.1.0-beta.1` de `luvittor/geoip-updater`, preservando
os caminhos de City/ASN, a flag de atualização, o reprocessamento de IPs e
a confidencialidade das credenciais.

## Escopo e restrições

- Composer VCS temporário e lockfile exato da beta.
- Bindings de `Transport`/`DatabaseValidator` no Laravel, com configuração existente.
- `geoip:update` desabilitado não exige credenciais; atualizações retornam
  `updated`/`current`/`failed`; sucesso integral precede reprocessar IPs.
- Não registrar mensagens de exceção brutas, account ID, license key ou Authorization.
- Remover implementações duplicadas sem consumidores, atualizar testes e documentação.
- Não modificar o pacote; não criar release estável, alterar produção, segredos,
  migrations ou comportamento de geolocalização de leitura.

## Aceite

- Pacote instalado em `backend/vendor` com lock de `v0.1.0-beta.1`.
- Testes do comando e integração de City/ASN sem rede, em fixtures temporários.
- Suítes serial e paralela, lint, auditoria e SDD PR contract aprovados.
- PR para `develop` somente para revisão; nenhuma decisão de merge automática.

## Autorização

Solicitação explícita de implementação em branch e abertura de PR pelo gdev em
2026-11-10. A autorização não abrange merge, release ou deploy.
